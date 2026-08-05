import { Controller, Post, Get, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OwnershipGuard } from '../../common/guards/ownership.guard';
import { CheckOwnership } from '../../common/decorators/check-ownership.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaymentsService } from './payments.service';
import { InitiateMpesaDto } from './dto/initiate-mpesa.dto';
import { Job } from '../jobs/models/job.model';
import { User, UserRole } from '../users/models/user.model';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('mpesa/initiate')
  @UseGuards(JwtAuthGuard)
  initiateStk(@Body() dto: InitiateMpesaDto, @CurrentUser() user: User) {
    return this.paymentsService.initiateStk(dto, user.id);
  }

  // Public — Daraja posts here (no JWT guard)
  @Post('mpesa/callback')
  mpesaCallback(@Body() body: any) {
    this.paymentsService.handleCallback(body);
    return { ResultCode: 0, ResultDesc: 'Accepted' };
  }

  @Get('status/:jobId')
  @UseGuards(JwtAuthGuard, OwnershipGuard)
  @CheckOwnership({ model: Job, idParam: 'jobId', bypassRoles: [UserRole.ADMIN, UserRole.CLERK] })
  getStatus(@Param('jobId') jobId: string, @CurrentUser() user: User) {
    return this.paymentsService.getPaymentStatus(jobId, user);
  }
}
