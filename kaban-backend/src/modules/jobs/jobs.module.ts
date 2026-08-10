import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { Job } from './models/job.model';
import { File } from '../files/models/file.model';
import { Setting } from '../admin/models/setting.model';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    SequelizeModule.forFeature([Job, File, Setting]),
    NotificationsModule,
  ],
  controllers: [JobsController],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}
