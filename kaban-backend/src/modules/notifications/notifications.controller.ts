import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { parsePagination } from '../../common/utils/pagination.util';
import { User } from '../users/models/user.model';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async getMyNotifications(
    @CurrentUser() user: User,
    @Query('limit') limit?: string,
  ) {
    const { size } = parsePagination(1, limit, { defaultSize: 30 });
    const notifications = await this.notificationsService.getForUser(user.id, size);
    return { statusCode: 200, message: 'ok', data: { notifications } };
  }
}
