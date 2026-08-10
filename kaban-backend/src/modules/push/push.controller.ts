import { Controller, Get, Post, Delete, Body, UseGuards } from '@nestjs/common';
import { PushService } from './push.service';
import { SubscribeDto } from './dto/subscribe.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/models/user.model';

@Controller('push')
export class PushController {
  constructor(private readonly pushService: PushService) {}

  @Get('vapid-key')
  getVapidKey() {
    return this.pushService.getVapidPublicKey();
  }

  @Post('subscribe')
  @UseGuards(JwtAuthGuard)
  async subscribe(@Body() dto: SubscribeDto, @CurrentUser() user: User) {
    await this.pushService.subscribe(user.id, dto.endpoint, dto.p256dh, dto.auth);
    return { subscribed: true };
  }

  @Delete('unsubscribe')
  @UseGuards(JwtAuthGuard)
  async unsubscribe(@CurrentUser() user: User) {
    await this.pushService.unsubscribe(user.id);
    return { unsubscribed: true };
  }
}
