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
    if (job.status === JobStatus.CANCELLED) {
      throw new BadRequestException('This job has been cancelled');
    }
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
    setTimeout(() => this.simulateSuccess(checkoutReqId, merchantReqId, Math.ceil(amount), dto.phone), 5000);

    return {
      checkoutRequestId: checkoutReqId,
      merchantRequestId: merchantReqId,
      responseCode:      '0',
      customerMessage:   'Success. Request accepted for processing',
    };
  }

  private async simulateSuccess(checkoutReqId: string, merchantReqId: string, amount: number, phone: string) {
    try {
      const fakeReceipt = `QAB${Math.random().toString(36).toUpperCase().slice(2, 10)}`;
      await this.handleCallback({
        Body: {
          stkCallback: {
            MerchantRequestID: merchantReqId,
            CheckoutRequestID: checkoutReqId,
            ResultCode:        0,
            ResultDesc:        'The service request is processed successfully.',
            CallbackMetadata: {
              Item: [
                { Name: 'Amount',              Value: amount },
                { Name: 'MpesaReceiptNumber',  Value: fakeReceipt },
                { Name: 'TransactionDate',     Value: Date.now() },
                { Name: 'PhoneNumber',         Value: phone },
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

    if (typeof CheckoutRequestID !== 'string' || !CheckoutRequestID) {
      this.logger.warn('Callback without a CheckoutRequestID, ignored');
      return;
    }
    // Daraja has been seen sending ResultCode both as a number and as a string.
    const resultCode = Number(ResultCode);
    const codeType = typeof ResultCode;
    if ((codeType !== 'number' && codeType !== 'string') || ResultCode === '' || !Number.isFinite(resultCode)) {
      this.logger.warn(`Callback with invalid ResultCode for ${CheckoutRequestID}, ignored`);
      return;
    }

    const payment = await this.paymentModel.findOne({ where: { checkoutReqId: CheckoutRequestID } });
    if (!payment) {
      this.logger.warn(`Callback for unknown checkoutReqId: ${CheckoutRequestID}`);
      return;
    }

    // Both IDs Daraja issued for this STK push must match. On a mismatch the payment is left
    // pending rather than failed, so a forged callback can't close it and shut out the real one.
    if (callback.MerchantRequestID !== payment.merchantReqId) {
      this.logger.error(`M-Pesa callback ${CheckoutRequestID}: MerchantRequestID mismatch, ignored`);
      return;
    }

    if (payment.status !== PaymentRecordStatus.PENDING) {
      this.logger.log(`M-Pesa callback ${CheckoutRequestID}: already processed`);
      return;
    }

    if (resultCode !== 0) {
      const closed = await this.closePending(payment, {
        status:     PaymentRecordStatus.FAILED,
        resultCode: String(ResultCode),
        resultDesc: String(ResultDesc ?? '').slice(0, 500),
      });
      if (!closed) return;
      this.logger.log(`M-Pesa callback ${CheckoutRequestID}: failed (ResultCode ${ResultCode}, payment ${payment.id})`);
      await this.notify('payment_failed', payment);
      return;
    }

    const items    = Array.isArray(CallbackMetadata?.Item) ? CallbackMetadata.Item : [];
    const getValue = (name: string) => items.find((i: any) => i?.Name === name)?.Value;
    const mpesaRef = String(getValue('MpesaReceiptNumber') ?? '').slice(0, 50);
    const paid     = Number(getValue('Amount'));
    const expected = Number(payment.amount);

    // The STK push asks for Math.ceil(amount), so a genuine payment is never below the stored amount.
    const problem =
      !mpesaRef                                   ? 'Missing receipt number'
      : !Number.isFinite(paid) || paid < expected ? `Amount mismatch: paid ${getValue('Amount')}, expected ${expected}`
      : null;

    if (problem) {
      // Money may have been taken, so keep the receipt for staff to reconcile and don't tell
      // the customer the payment failed. The job stays unpaid until staff mark it paid.
      this.logger.error(`M-Pesa callback rejected for payment ${payment.id} (job ${payment.jobId}): ${problem}`);
      await this.closePending(payment, {
        status:       PaymentRecordStatus.FAILED,
        resultCode:   String(ResultCode),
        resultDesc:   problem,
        mpesaRef:     mpesaRef || null,
        mpesaReceipt: mpesaRef || null,
      });
      return;
    }

    const closed = await this.closePending(payment, {
      status:       PaymentRecordStatus.COMPLETED,
      mpesaRef,
      mpesaReceipt: mpesaRef,
      paidAt:       new Date(),
    });
    if (!closed) return; // a concurrent callback got there first
    this.logger.log(
      `M-Pesa callback ${CheckoutRequestID}: completed (payment ${payment.id}, job ${payment.jobId}, KES ${paid})`,
    );

    await this.jobModel.update(
      { paymentStatus: PaymentStatus.PAID, mpesaRef },
      { where: { id: payment.jobId } },
    );

    await this.notify('payment_confirmed', payment);
  }

  /** Moves a payment out of PENDING; false if another callback (or a cancel) already did. */
  private async closePending(payment: Payment, values: Partial<Payment>) {
    const [affected] = await this.paymentModel.update(values, {
      where: { id: payment.id, status: PaymentRecordStatus.PENDING },
    });
    return affected === 1;
  }

  private async notify(type: 'payment_confirmed' | 'payment_failed', payment: Payment) {
    const job  = await this.jobModel.findOne({ where: { id: payment.jobId } });
    const user = await this.userModel.findOne({ where: { id: payment.userId } });
    if (!job || !user) return;
    try {
      await this.notificationsService.send(type, {
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
