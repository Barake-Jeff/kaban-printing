import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { SequelizeModule } from '@nestjs/sequelize';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AuthModule } from './modules/auth/auth.module';
import { PushModule } from './modules/push/push.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { UsersModule } from './modules/users/users.module';
import { FilesModule } from './modules/files/files.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { AdminModule } from './modules/admin/admin.module';
import { Setting } from './modules/admin/models/setting.model';
import { User } from './modules/users/models/user.model';
import { RefreshToken } from './modules/auth/models/refresh-token.model';
import { PasswordResetRequest } from './modules/auth/models/password-reset-request.model';
import { PushSubscription } from './modules/push/models/push-subscription.model';
import { NotificationLog } from './modules/notifications/models/notification-log.model';
import { File } from './modules/files/models/file.model';
import { Job } from './modules/jobs/models/job.model';
import { Payment } from './modules/payments/models/payment.model';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    SequelizeModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        dialect:  'mysql',
        host:     config.get('DB_HOST'),
        port:     config.get<number>('DB_PORT'),
        username: config.get('DB_USERNAME'),
        password: config.get('DB_PASSWORD'),
        database: config.get('DB_NAME'),
        // Order matters: User before File before Job before Payment
        models:        [User, RefreshToken, PasswordResetRequest, PushSubscription, NotificationLog, File, Job, Payment, Setting],
        autoLoadModels: true,
        synchronize:   config.get('NODE_ENV') !== 'production',
        logging:       config.get('NODE_ENV') !== 'production' ? console.log : false,
        define:        { underscored: true },
      }),
    }),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 60 }]),
    ScheduleModule.forRoot(),
    AuthModule,
    PushModule,
    NotificationsModule,
    UsersModule,
    FilesModule,
    JobsModule,
    PaymentsModule,
    AdminModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
