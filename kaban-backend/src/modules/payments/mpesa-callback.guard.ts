import {
  CanActivate, ExecutionContext, ForbiddenException, Injectable, Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, timingSafeEqual } from 'crypto';

// Safaricom's published Daraja callback source addresses (production). If Safaricom adds
// one, list the full set in MPESA_CALLBACK_IPS rather than waiting for a code change.
export const SAFARICOM_CALLBACK_IPS = [
  '196.201.214.200', '196.201.214.206', '196.201.213.114', '196.201.214.207',
  '196.201.214.208', '196.201.213.44',  '196.201.212.127', '196.201.212.138',
  '196.201.212.129', '196.201.212.136', '196.201.212.74',  '196.201.212.69',
];

const MIN_TOKEN_LENGTH = 32;

const sha256 = (value: string) => createHash('sha256').update(value).digest();

/**
 * Network-level gate for the public M-Pesa callback (OWASP API6). Two independent checks:
 * a secret token in the callback URL, and the caller's IP against Safaricom's list.
 * Neither is trusted alone — PaymentsService.handleCallback still validates the payload
 * against the payment we created (IDs, amount, receipt) before marking anything paid.
 *
 * Fails closed: no usable token configured means every callback is refused.
 */
@Injectable()
export class MpesaCallbackGuard implements CanActivate {
  private readonly logger = new Logger(MpesaCallbackGuard.name);
  private readonly tokenHash: Buffer | null;
  private readonly allowedIps: Set<string> | null; // null = IP check off (sandbox only)

  constructor(config: ConfigService) {
    const token = config.get<string>('MPESA_CALLBACK_TOKEN')?.trim() ?? '';
    if (token.length >= MIN_TOKEN_LENGTH) {
      this.tokenHash = sha256(token);
    } else {
      this.tokenHash = null;
      this.logger.error(
        `MPESA_CALLBACK_TOKEN is missing or shorter than ${MIN_TOKEN_LENGTH} characters; all M-Pesa callbacks will be refused`,
      );
    }

    const configured = (config.get<string>('MPESA_CALLBACK_IPS') ?? '')
      .split(',').map(ip => ip.trim()).filter(Boolean);
    const sandbox = config.get<string>('MPESA_ENVIRONMENT')?.trim() === 'sandbox';

    if (configured.length) this.allowedIps = new Set(configured);
    else if (sandbox)      this.allowedIps = null; // sandbox / ngrok callbacks don't come from the production IPs
    else                   this.allowedIps = new Set(SAFARICOM_CALLBACK_IPS);
  }

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const ip  = String(req.ip ?? '').replace(/^::ffff:/, '');

    const token = typeof req.params?.token === 'string' ? req.params.token : '';
    if (!this.tokenHash || !timingSafeEqual(sha256(token), this.tokenHash)) {
      return this.reject('bad token', ip, req);
    }
    if (this.allowedIps && !this.allowedIps.has(ip)) {
      return this.reject('ip not allowed', ip, req);
    }
    return true;
  }

  // Never log the token itself.
  private reject(reason: string, ip: string, req: any): never {
    this.logger.warn(`M-Pesa callback refused (${reason}) from ${ip || 'unknown'} ua="${req.headers?.['user-agent'] ?? ''}"`);
    throw new ForbiddenException();
  }
}
