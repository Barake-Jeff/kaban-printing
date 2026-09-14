import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { Job, JobStatus } from '../jobs/models/job.model';
import { User, UserRole } from '../users/models/user.model';
import { NotificationsService } from '../notifications/notifications.service';

const OVERDUE_MINUTES = 30;

@Injectable()
export class JobReadyReminderService {
  private readonly logger = new Logger(JobReadyReminderService.name);

  constructor(
    @InjectModel(Job)  private readonly jobModel: typeof Job,
    @InjectModel(User) private readonly userModel: typeof User,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async notifyOverdueReadyJobs() {
    const cutoff = new Date(Date.now() - OVERDUE_MINUTES * 60 * 1000);

    const overdueJobs = await this.jobModel.findAll({
      where: {
        status:                 JobStatus.READY,
        readyAt:                { [Op.lte]: cutoff },
        readyOverdueNotifiedAt: null,
      },
    });
    if (!overdueJobs.length) return;

    const staff = await this.userModel.findAll({
      where: { role: { [Op.in]: [UserRole.CLERK, UserRole.ADMIN] }, active: true },
    });
    if (!staff.length) return;

    for (const job of overdueJobs) {
      // Claim before sending: guarantees "fires once" even if a send hangs or
      // fails, and avoids a retry storm on the next tick.
      await job.update({ readyOverdueNotifiedAt: new Date() });

      const payload = {
        title: 'Job waiting for pickup ⏰',
        body:  `Job #${job.id.slice(0, 8)} has been ready for 30+ min and hasn't been marked delivered.`,
        url:   '/admin/queue',
      };
      await Promise.all(
        staff.map(s => this.notificationsService.sendPush(s.id, payload)
          .catch(err => this.logger.error(`Overdue push failed for staff ${s.id}, job ${job.id}: ${err.message}`))),
      );
    }
  }
}
