import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import {
  InjectThrottlerOptions, InjectThrottlerStorage,
  ThrottlerGuard, ThrottlerModuleOptions, ThrottlerStorage,
} from '@nestjs/throttler';

// Login / register / refresh / forgot-password are always throttled per IP, even when a
// valid bearer token is attached. Otherwise a caller could register accounts in a loop and
// get a fresh per-user bucket each time, defeating the brute-force limits on those routes.
// Case-insensitive because Express routing is.
const AUTH_FLOW_PATH = /^\/+api\/+(admin\/+)?auth(\/|$)/i;

/**
 * Rate-limits signed-in callers per user and everyone else per IP.
 *
 * Customers on mobile data or shared Wi-Fi commonly share one public IP, so a purely
 * per-IP limit would throttle them against each other. This guard runs before
 * JwtAuthGuard (global guards go first), so `req.user` isn't set yet; the token is
 * therefore *verified* here rather than merely decoded — an unverified `sub` could be
 * forged to pick an arbitrary bucket.
 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storageService: ThrottlerStorage,
    reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {
    super(options, storageService, reflector);
  }

  protected async getTracker(req: Record<string, any>): Promise<string> {
    const userId = this.verifiedUserId(req);
    if (userId && !AUTH_FLOW_PATH.test(req.path ?? '')) return `user:${userId}`;
    return super.getTracker(req);
  }

  private verifiedUserId(req: Record<string, any>): string | null {
    const match = /^Bearer\s+(.+)$/i.exec(req.headers?.authorization ?? '');
    if (!match) return null;

    try {
      const payload = this.jwt.verify<{ sub?: unknown }>(match[1], {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      });
      return typeof payload.sub === 'string' ? payload.sub : null;
    } catch {
      return null; // expired / forged / wrong token type — treat as anonymous
    }
  }
}
