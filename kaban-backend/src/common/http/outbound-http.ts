import { HttpException, HttpStatus, Logger, Type } from '@nestjs/common';
import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

// Every call to a third-party API (Daraja, Africa's Talking, WhatsApp) goes through this file
// (OWASP API10). It bounds how long and how much we wait, refuses redirects, validates what
// comes back, and logs failures without headers or bodies — those carry tokens, phone
// numbers and amounts.

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_BYTES = 1024 * 1024;

export interface OutboundClientOptions {
  /** Shown in logs and in the client-facing error, e.g. "M-Pesa". */
  name: string;
  /** From config only — never from request input (OWASP API7). Must be https. */
  baseURL: string;
  timeoutMs?: number;
  maxBytes?: number;
}

/**
 * A provider call failed: timeout, network error, or a non-2xx status. Surfaces as 502/504
 * with a message naming only the provider. `upstreamStatus` / `upstreamBody` are for the
 * calling code to inspect; never log or return `upstreamBody`.
 */
export class UpstreamError extends HttpException {
  constructor(
    readonly provider: string,
    /** `invalid`: a response came back but was unusable (e.g. over maxBytes). */
    readonly kind: 'timeout' | 'network' | 'status' | 'invalid',
    readonly upstreamStatus?: number,
    readonly upstreamBody?: unknown,
  ) {
    super(
      `${provider} is not available right now. Please try again shortly.`,
      kind === 'timeout' ? HttpStatus.GATEWAY_TIMEOUT : HttpStatus.BAD_GATEWAY,
    );
  }

  /** Safe to try again: the provider didn't answer, or said it was overloaded / failing. */
  get transient(): boolean {
    if (this.kind === 'timeout' || this.kind === 'network') return true;
    return this.upstreamStatus === 429 || (this.upstreamStatus ?? 0) >= 500;
  }
}

/** A provider answered 2xx but not with the shape we rely on. Never echoes what it sent. */
export class UpstreamResponseError extends HttpException {
  constructor(readonly provider: string) {
    super(`${provider} returned an unexpected response. Please try again shortly.`, HttpStatus.BAD_GATEWAY);
  }
}

export function createOutboundClient(options: OutboundClientOptions): AxiosInstance {
  const { name, baseURL } = options;
  const logger = new Logger(`Outbound:${name}`);

  let parsed: URL;
  try {
    parsed = new URL(baseURL);
  } catch {
    throw new Error(`${name}: baseURL is not a valid URL`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`${name}: baseURL must use https`);

  const client = axios.create({
    baseURL,
    timeout: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    maxContentLength: options.maxBytes ?? DEFAULT_MAX_BYTES,
    maxBodyLength: options.maxBytes ?? DEFAULT_MAX_BYTES,
    // A redirect could send the request (and its Authorization header) to another host.
    maxRedirects: 0,
  });

  client.interceptors.request.use((config: InternalAxiosRequestConfig & { startedAt?: number }) => {
    config.startedAt = Date.now();
    return config;
  });

  client.interceptors.response.use(undefined, (err: AxiosError) => {
    const config = err.config as (InternalAxiosRequestConfig & { startedAt?: number }) | undefined;
    const method = (config?.method ?? 'get').toUpperCase();
    const path = (config?.url ?? '').split('?')[0]; // query strings can carry credentials
    const ms = config?.startedAt ? Date.now() - config.startedAt : undefined;
    const status = err.response?.status;

    const kind = status !== undefined ? 'status'
      : err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT' ? 'timeout'
      : err.code === AxiosError.ERR_BAD_RESPONSE ? 'invalid' // e.g. body over maxBytes
      : 'network';

    logger.warn(`${method} ${path} failed: ${kind}${status ? ` ${status}` : ''}${err.code ? ` (${err.code})` : ''}${ms !== undefined ? ` after ${ms}ms` : ''}`);
    return Promise.reject(new UpstreamError(name, kind, status, err.response?.data));
  });

  return client;
}

/**
 * Validates a provider response against a class-validator DTO and returns the typed result.
 * Properties without decorators are stripped. On failure logs only the failing field names.
 */
export function parseUpstream<T extends object>(dto: Type<T>, data: unknown, provider: string): T {
  const logger = new Logger(`Outbound:${provider}`);
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    logger.warn(`Unexpected response for ${dto.name}: not an object`);
    throw new UpstreamResponseError(provider);
  }

  // Implicit conversion because providers are loose with types: Daraja sends expires_in as "3599".
  const instance = plainToInstance(dto, data, { enableImplicitConversion: true });
  const errors = validateSync(instance, { whitelist: true });
  if (errors.length) {
    logger.warn(`Unexpected response for ${dto.name}: invalid ${errors.map(e => e.property).join(', ')}`);
    throw new UpstreamResponseError(provider);
  }
  return instance;
}

export interface RetryOptions {
  attempts?: number;
  baseDelayMs?: number;
}

/**
 * Retries `fn` on transient provider failures (timeouts, network errors, 429, 5xx) with
 * exponential backoff and jitter.
 *
 * ONLY for idempotent calls: the OAuth token fetch and STK *query*. Never wrap an STK push or
 * an SMS/WhatsApp send — a request that timed out may still have gone through, and retrying
 * it can charge the customer or message them twice.
 */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const attempts = options.attempts ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 500;

  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const retryable = err instanceof UpstreamError && err.transient;
      if (!retryable || attempt >= attempts) throw err;
      const delay = baseDelayMs * 2 ** (attempt - 1) * (0.5 + Math.random() / 2);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
