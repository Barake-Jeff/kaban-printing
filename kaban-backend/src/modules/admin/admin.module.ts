import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { Job } from '../jobs/models/job.model';
import { User } from '../users/models/user.model';
import { Payment } from '../payments/models/payment.model';
import { Setting } from './models/setting.model';
import { NotificationsModule } from '../notifications/notifications.module';
import { FilesModule } from '../files/files.module';

@Module({
  imports: [
    SequelizeModule.forFeature([Job, User, Payment, Setting]),
    NotificationsModule,
    FilesModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
