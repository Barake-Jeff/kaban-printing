import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { ConfigService } from '@nestjs/config';
import * as webpush from 'web-push';
import { PushSubscription } from './models/push-subscription.model';

export interface PushPayload {
  title: string;
  body: string;
  url: string;
}

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(
    @InjectModel(PushSubscription)
    private readonly pushSubModel: typeof PushSubscription,
    private readonly config: ConfigService,
  ) {
    webpush.setVapidDetails(
      config.get<string>('VAPID_SUBJECT'),
      config.get<string>('VAPID_PUBLIC_KEY'),
      config.get<string>('VAPID_PRIVATE_KEY'),
    );
  }

  getVapidPublicKey(): { publicKey: string } {
    return { publicKey: this.config.get<string>('VAPID_PUBLIC_KEY') };
  }

  async subscribe(userId: string, endpoint: string, p256dh: string, auth: string): Promise<void> {
    await this.pushSubModel.destroy({ where: { userId } });
    await this.pushSubModel.create({ userId, endpoint, p256dh, auth });
  }

  async unsubscribe(userId: string): Promise<void> {
    await this.pushSubModel.destroy({ where: { userId } });
  }

  async getSubscriptions(userId: string): Promise<PushSubscription[]> {
    return this.pushSubModel.findAll({ where: { userId } });
  }

  async hasSubscription(userId: string): Promise<boolean> {
    const count = await this.pushSubModel.count({ where: { userId } });
    return count > 0;
  }

  async sendPush(userId: string, payload: PushPayload): Promise<void> {
    const subs = await this.getSubscriptions(userId);
    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
        );
      } catch (err: any) {
        if (err.statusCode === 410) {
          await sub.destroy();
          this.logger.log(`Removed expired push subscription for user ${userId}`);
        } else {
          this.logger.error(`Push send failed for user ${userId}: ${err.message}`);
        }
      }
    }
  }
}
