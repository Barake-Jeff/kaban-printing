import {
  Injectable, NotFoundException, BadRequestException, Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { v4 as uuid } from 'uuid';
import { Payment, PaymentRecordStatus, PaymentRecordMethod } from './models/payment.model';
import { Job, JobStatus, PaymentStatus } from '../jobs/models/job.model';
import { User, UserRole } from '../users/models/user.model';
import { NotificationsService } from '../notifications/notifications.service';
import { InitiateMpesaDto } from './dto/initiate-mpesa.dto';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectModel(Payment) private readonly paymentModel: typeof Payment,
    @InjectModel(Job)     private readonly jobModel:     typeof Job,
    @InjectModel(User)    private readonly userModel:    typeof User,
    private readonly notificationsService: NotificationsService,
  ) {}

  async initiateStk(dto: InitiateMpesaDto, userId: string) {
    const job = await this.jobModel.findOne({ where: { id: dto.jobId, userId } });
    if (!job) throw new NotFoundException('Job not found');
    if (job.paymentStatus === PaymentStatus.PAID) {
      throw new BadRequestException('Job is already paid');
    }

    const amount            = Number(job.cost) + Number(job.deliveryFee);
    const checkoutReqId     = `stub_${uuid()}`;
    const merchantReqId     = `mock_${uuid()}`;

    await this.paymentModel.create({
      jobId: job.id,
      userId,
      method:        PaymentRecordMethod.MPESA,
      amount,
      status:        PaymentRecordStatus.PENDING,
      phone:         dto.phone,
      checkoutReqId,
      merchantReqId,
    });

    this.logger.log(`[M-Pesa STUB] STK Push → ${dto.phone} KES ${amount} (job ${job.id})`);

    // Auto-confirm after 5 seconds (stub behaviour)
    setTimeout(() => this.simulateSuccess(checkoutReqId, job.id, userId), 5000);

    return {
      checkoutRequestId: checkoutReqId,
      merchantRequestId: merchantReqId,
      responseCode:      '0',
      customerMessage:   'Success. Request accepted for processing',
    };
  }

  private async simulateSuccess(checkoutReqId: string, jobId: string, userId: string) {
    try {
      const fakeReceipt = `QAB${Math.random().toString(36).toUpperCase().slice(2, 10)}`;
      await this.handleCallback({
        Body: {
          stkCallback: {
            CheckoutRequestID: checkoutReqId,
            ResultCode:        0,
            ResultDesc:        'The service request is processed successfully.',
            CallbackMetadata: {
              Item: [
                { Name: 'Amount',              Value: 0 },
                { Name: 'MpesaReceiptNumber',  Value: fakeReceipt },
                { Name: 'TransactionDate',     Value: Date.now() },
                { Name: 'PhoneNumber',         Value: '' },
              ],
            },
          },
        },
      });
    } catch (err) {
      this.logger.error(`simulateSuccess failed: ${err.message}`);
    }
  }

  async handleCallback(body: any) {
    const callback = body?.Body?.stkCallback;
    if (!callback) return;

    const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = callback;

    const payment = await this.paymentModel.findOne({ where: { checkoutReqId: CheckoutRequestID } });
    if (!payment) {
      this.logger.warn(`Callback for unknown checkoutReqId: ${CheckoutRequestID}`);
      return;
    }

    if (payment.status !== PaymentRecordStatus.PENDING) return; // already processed

    if (ResultCode === 0) {
      const items    = CallbackMetadata?.Item ?? [];
      const getValue = (name: string) => items.find((i: any) => i.Name === name)?.Value;
      const mpesaRef = String(getValue('MpesaReceiptNumber') ?? '');

      await payment.update({
        status:       PaymentRecordStatus.COMPLETED,
        mpesaRef,
        mpesaReceipt: mpesaRef,
        paidAt:       new Date(),
      });

      await this.jobModel.update(
        { paymentStatus: PaymentStatus.PAID, mpesaRef },
        { where: { id: payment.jobId } },
      );

      const job  = await this.jobModel.findOne({ where: { id: payment.jobId } });
      const user = await this.userModel.findOne({ where: { id: payment.userId } });
      if (job && user) {
        try {
          await this.notificationsService.send('payment_confirmed', {
            jobId: job.id, userId: user.id,
            user: {
              name: user.name, phone: user.phone, houseNumber: user.houseNumber,
              notifSms: user.notifSms, notifWhatsapp: user.notifWhatsapp,
            },
            job: {
              fileName: job.fileName, pages: job.pages, copies: job.copies,
              cost: Number(job.cost), deliveryFee: Number(job.deliveryFee),
              deliveryType: job.deliveryType,
            },
          });
        } catch { /* notification failure must not crash callback */ }
      }
    } else {
      await payment.update({
        status:     PaymentRecordStatus.FAILED,
        resultCode: String(ResultCode),
        resultDesc: ResultDesc,
      });

      const job  = await this.jobModel.findOne({ where: { id: payment.jobId } });
      const user = await this.userModel.findOne({ where: { id: payment.userId } });
      if (job && user) {
        try {
          await this.notificationsService.send('payment_failed', {
            jobId: job.id, userId: user.id,
            user: {
              name: user.name, phone: user.phone, houseNumber: user.houseNumber,
              notifSms: user.notifSms, notifWhatsapp: user.notifWhatsapp,
            },
            job: {
              fileName: job.fileName, pages: job.pages, copies: job.copies,
              cost: Number(job.cost), deliveryFee: Number(job.deliveryFee),
              deliveryType: job.deliveryType,
            },
          });
        } catch { /* notification failure must not crash callback */ }
      }
    }
  }

  async getPaymentStatus(jobId: string, user: User) {
    const isBypass = user.role === UserRole.ADMIN || user.role === UserRole.CLERK;
    const job = await this.jobModel.findOne({
      where: isBypass ? { id: jobId } : { id: jobId, userId: user.id },
    });
    if (!job) throw new NotFoundException('Job not found');

    const payment = await this.paymentModel.findOne({ where: { jobId } });

    return {
      jobId,
      status:        job.status,
      paymentStatus: job.paymentStatus,
      mpesaRef:      job.mpesaRef,
      payment: payment ? {
        status:        payment.status,
        mpesaRef:      payment.mpesaRef,
        checkoutReqId: payment.checkoutReqId,
      } : null,
    };
  }
}
