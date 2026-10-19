import { Controller, Post, Get, Param, Body, UseGuards, Logger, HttpCode } from '@nestjs/common';
import { RawResponse } from '../../common/decorators/raw-response.decorator';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OwnershipGuard } from '../../common/guards/ownership.guard';
import { CheckOwnership } from '../../common/decorators/check-ownership.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaymentsService } from './payments.service';
import { MpesaCallbackGuard } from './mpesa-callback.guard';
import { InitiateMpesaDto } from './dto/initiate-mpesa.dto';
import { Job } from '../jobs/models/job.model';
import { User, UserRole } from '../users/models/user.model';

@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(private readonly paymentsService: PaymentsService) {}

  // Each call pops an STK prompt on a phone, so keep it tight.
  @Post('mpesa/initiate')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @UseGuards(JwtAuthGuard)
  initiateStk(@Body() dto: InitiateMpesaDto, @CurrentUser() user: User) {
    return this.paymentsService.initiateStk(dto, user.id);
  }

  // Public — Daraja posts here (no JWT guard). The URL token and Safaricom's IPs are
  // checked by MpesaCallbackGuard; the payload itself is checked in handleCallback.
  // Unauthenticated callers are throttled per IP and Safaricom spreads callbacks over ~12
  // addresses, so 30/min each is far above real volume. Don't go much lower: a throttled
  // genuine callback is a lost payment confirmation.
  @Post('mpesa/callback/:token')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @UseGuards(MpesaCallbackGuard)
  // Daraja expects exactly 200 { ResultCode, ResultDesc }, not our usual wrapper.
  @HttpCode(200)
  @RawResponse()
  async mpesaCallback(@Body() body: any) {
    try {
      await this.paymentsService.handleCallback(body);
    } catch (err) {
      // Still acknowledge: Daraja only needs the receipt, the failure is ours to investigate.
      const error = err instanceof Error ? err : new Error(String(err));
      this.logger.error(`M-Pesa callback failed: ${error.message}`, error.stack);
    }
    return { ResultCode: 0, ResultDesc: 'Accepted' };
  }

  @Get('status/:jobId')
  @UseGuards(JwtAuthGuard, OwnershipGuard)
  @CheckOwnership({ model: Job, idParam: 'jobId', bypassRoles: [UserRole.ADMIN, UserRole.CLERK] })
  getStatus(@Param('jobId') jobId: string, @CurrentUser() user: User) {
    return this.paymentsService.getPaymentStatus(jobId, user);
  }
}
