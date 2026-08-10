import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { PushController } from './push.controller';
import { PushService } from './push.service';
import { PushSubscription } from './models/push-subscription.model';

@Module({
  imports: [SequelizeModule.forFeature([PushSubscription])],
  controllers: [PushController],
  providers: [PushService],
  exports: [PushService],
})
export class PushModule {}
