import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationLog } from './models/notification-log.model';
import { PushModule } from '../push/push.module';

@Module({
  imports: [
    SequelizeModule.forFeature([NotificationLog]),
    PushModule,
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
