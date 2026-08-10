import { Controller, Get, Patch, Post, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateNotifPrefsDto } from './dto/update-notif-prefs.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { User } from './models/user.model';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getMe(@CurrentUser() user: User) {
    return this.usersService.getMe(user.id);
  }

  @Patch('me')
  updateProfile(@CurrentUser() user: User, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(user.id, dto);
  }

  @Patch('me/notifications')
  updateNotifPrefs(@CurrentUser() user: User, @Body() dto: UpdateNotifPrefsDto) {
    return this.usersService.updateNotifPrefs(user.id, dto);
  }

  @Post('me/change-password')
  changePassword(@CurrentUser() user: User, @Body() dto: ChangePasswordDto) {
    return this.usersService.changePassword(user.id, dto);
  }
}
