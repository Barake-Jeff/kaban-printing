import { plainToInstance } from 'class-transformer';
import {
  IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min, MinLength, validateSync,
} from 'class-validator';

const MIN_SECRET_LENGTH = 32;

// Settings the app cannot run correctly without (OWASP API8). Checked once at startup so a
// misconfigured deploy fails immediately with a clear message instead of on first use.
// Optional integrations (MPESA_*, TRUST_PROXY, MINIO_PUBLIC_*) are checked where they're used.
class EnvironmentVariables {
  @IsOptional() @IsIn(['development', 'production', 'test'])
  NODE_ENV?: string;

  @IsOptional() @IsInt() @Min(1) @Max(65535)
  PORT?: number;

  @IsString() @IsNotEmpty() DB_HOST: string;
  @IsInt() @Min(1) @Max(65535) DB_PORT: number;
  @IsString() @IsNotEmpty() DB_USERNAME: string;
  @IsString() @IsNotEmpty() DB_NAME: string;

  @IsString() @MinLength(MIN_SECRET_LENGTH) JWT_ACCESS_SECRET: string;
  @IsString() @MinLength(MIN_SECRET_LENGTH) JWT_REFRESH_SECRET: string;

  @IsString() @IsNotEmpty() MINIO_ENDPOINT: string;
  @IsOptional() @IsInt() @Min(1) @Max(65535) MINIO_PORT?: number;
  @IsString() @IsNotEmpty() MINIO_ACCESS_KEY: string;
  @IsString() @IsNotEmpty() MINIO_SECRET_KEY: string;
  @IsString() @IsNotEmpty() MINIO_BUCKET: string;

  @IsString() @IsNotEmpty() VAPID_PUBLIC_KEY: string;
  @IsString() @IsNotEmpty() VAPID_PRIVATE_KEY: string;
  @IsString() @IsNotEmpty() VAPID_SUBJECT: string;

  @IsString() @IsNotEmpty() FRONTEND_URL: string;
}

/**
 * ConfigModule `validate` hook. Throws one error naming every bad variable and the rule it
 * broke, never the value, since these are secrets. Returns the config untouched so
 * existing `config.get()` callers keep seeing the raw strings they expect.
 */
export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  // Empty strings count as unset (an `.env` line like `PORT=` sets "").
  const present = Object.fromEntries(Object.entries(config).filter(([, v]) => v !== ''));
  const env = plainToInstance(EnvironmentVariables, present, { enableImplicitConversion: true });

  const problems = validateSync(env, { skipMissingProperties: false }).map(err =>
    `${err.property}: ${Object.keys(err.constraints ?? {}).join(', ') || 'invalid'}`,
  );

  if (env.JWT_ACCESS_SECRET && env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
    problems.push('JWT_REFRESH_SECRET: must differ from JWT_ACCESS_SECRET');
  }

  if (env.NODE_ENV === 'production') {
    if (!present.DB_PASSWORD) problems.push('DB_PASSWORD: required in production');
    for (const key of ['MINIO_ACCESS_KEY', 'MINIO_SECRET_KEY'] as const) {
      if (env[key] === 'minioadmin') problems.push(`${key}: must not be the MinIO default in production`);
    }
  }

  if (problems.length) {
    throw new Error(`Invalid environment configuration:\n  - ${problems.join('\n  - ')}`);
  }
  return config;
}
