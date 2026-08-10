import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { NotificationLog } from './models/notification-log.model';
import { PushService, PushPayload } from '../push/push.service';

export type NotificationTrigger =
  | 'job_received'
  | 'payment_confirmed'
  | 'printing_started'
  | 'job_ready'
  | 'job_delivered'
  | 'payment_failed';

export interface JobContext {
  jobId: string;
  userId: string;
  user: {
    name: string;
    phone: string;
    houseNumber: string;
    notifSms: boolean;
    notifWhatsapp: boolean;
  };
  job: {
    fileName: string | null;
    pages: number;
    copies: number;
    cost: number;
    deliveryFee: number;
    deliveryType: string;
  };
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectModel(NotificationLog)
    private readonly logModel: typeof NotificationLog,
    private readonly pushService: PushService,
  ) {}

  async getForUser(userId: string, limit = 30) {
    return this.logModel.findAll({
      where: { userId },
      order: [['sentAt', 'DESC']],
      limit,
      attributes: ['id', 'jobId', 'trigger', 'channel', 'status', 'sentAt'],
    });
  }

  async send(trigger: NotificationTrigger, context: JobContext): Promise<void> {
    const { jobId, userId, user, job } = context;

    const hasPush = await this.pushService.hasSubscription(userId);

    if (hasPush) {
      const payload = this.buildPushPayload(trigger, jobId);
      await this.pushService.sendPush(userId, payload);
      await this.log(jobId, userId, 'push', trigger, null, payload.body, 'sent');
      return;
    }

    const message = this.buildSmsMessage(trigger, { ...user, ...job, jobId });

    // SMS: send on all triggers except printing_started
    if (trigger !== 'printing_started' && user.notifSms) {
      await this.sendSms(user.phone, message, jobId, userId, trigger);
    }

    // WhatsApp: only on job_ready
    if (trigger === 'job_ready' && user.notifWhatsapp) {
      await this.sendWhatsapp(user.phone, message, jobId, userId, trigger);
    }
  }

  async sendPush(userId: string, payload: PushPayload): Promise<void> {
    await this.pushService.sendPush(userId, payload);
  }

  private buildPushPayload(trigger: NotificationTrigger, jobId: string): PushPayload {
    const url = `/app/orders/${jobId}`;
    const payloads: Record<NotificationTrigger, PushPayload> = {
      job_received:      { title: 'Print job received',     body: `Job #${jobId} is in the queue. Pay via M-Pesa to confirm.`, url },
      payment_confirmed: { title: 'Payment confirmed ✓',   body: `Job #${jobId} is confirmed and in the print queue.`,        url },
      printing_started:  { title: 'Now printing 🖨',       body: `Job #${jobId} is being printed now.`,                       url },
      job_ready:         { title: 'Your print is ready! 🎉', body: `Job #${jobId} is ready for collection.`,                  url },
      job_delivered:     { title: 'Job delivered ✓',       body: `Job #${jobId} has been delivered. Thank you!`,              url },
      payment_failed:    { title: 'Payment failed',         body: `Payment for Job #${jobId} was not completed. Please try again.`, url },
    };
    return payloads[trigger];
  }

  private buildSmsMessage(trigger: NotificationTrigger, data: Record<string, any>): string {
    const firstName = (data.name as string).split(' ')[0];
    const templates: Record<NotificationTrigger, string> = {
      job_received:      `Hi ${firstName}! Your print job has been received.\n\nJob #${data.jobId} · House ${data.houseNumber}\nFile: ${data.fileName ?? 'Custom job'}\n${data.pages} pages · ${data.copies} copies\n\nTotal: KES ${data.cost + data.deliveryFee}\n\nPay via M-Pesa to confirm your order.`,
      payment_confirmed: `✓ Payment received — KES ${data.cost + data.deliveryFee}\n\nJob #${data.jobId} is now in the print queue. We'll notify you when it's ready.\n\nEst. wait: 20–30 min.`,
      printing_started:  `🖨 Your job is printing now.\n\nJob #${data.jobId} · House ${data.houseNumber}\nShould be ready in ~10 minutes.`,
      job_ready:         data.deliveryType === 'delivery'
        ? `Your print is on the way! 🚚\n\nJob #${data.jobId} · House ${data.houseNumber}\n\nYour documents are being delivered.\n\nThank you for using PrintEase.`
        : `Your print is ready! 🎉\n\nJob #${data.jobId} · House ${data.houseNumber}\n\nCome collect at your convenience. We're open until 8 PM.\n\nThank you for using PrintEase.`,
      job_delivered:     `Job #${data.jobId} collected. Thank you!\n\nNeed to print again? Visit printease.co.ke\n\nPrintEase — your neighbourhood print shop 🏠`,
      payment_failed:    `Payment for Job #${data.jobId} was not completed.\n\nPlease try again from the PrintEase app or contact support.\n\nPrintEase Support: 0712 345 678`,
    };
    return templates[trigger] ?? `Update on Job #${data.jobId}: ${trigger}`;
  }

  private async sendSms(phone: string, message: string, jobId: string, userId: string, trigger: string): Promise<void> {
    // Africa's Talking expects +254... format
    const formatted = phone.startsWith('+') ? phone : `+254${phone.replace(/^0/, '')}`;
    try {
      // TODO: integrate africastalking SDK when AT_API_KEY is set
      // const result = await this.sms.send({ to: [formatted], message, from: 'PrintEase' });
      this.logger.log(`[SMS stub] → ${formatted}: ${message.slice(0, 60)}…`);
      await this.log(jobId, userId, 'sms', trigger, formatted, message, 'sent');
    } catch (err: any) {
      this.logger.error(`SMS failed for ${formatted}: ${err.message}`);
      await this.log(jobId, userId, 'sms', trigger, formatted, message, 'failed');
    }
  }

  private async sendWhatsapp(phone: string, message: string, jobId: string, userId: string, trigger: string): Promise<void> {
    const formatted = `254${phone.replace(/^0/, '').replace(/^\+254/, '')}`;
    try {
      // TODO: integrate WhatsApp Business API when WHATSAPP_TOKEN is set
      this.logger.log(`[WhatsApp stub] → ${formatted}: ${message.slice(0, 60)}…`);
      await this.log(jobId, userId, 'whatsapp', trigger, formatted, message, 'sent');
    } catch (err: any) {
      this.logger.error(`WhatsApp failed for ${formatted}: ${err.message}`);
      await this.log(jobId, userId, 'whatsapp', trigger, formatted, message, 'failed');
    }
  }

  private async log(
    jobId: string, userId: string,
    channel: 'sms' | 'whatsapp' | 'push',
    trigger: string, phone: string | null, message: string,
    status: 'sent' | 'failed', providerId?: string,
  ): Promise<void> {
    try {
      await this.logModel.create({ jobId, userId, channel, trigger, phone, message, status, providerId });
    } catch (err: any) {
      this.logger.error(`Notification log failed: ${err.message}`);
    }
  }
}
