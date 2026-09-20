import { Controller, Post, Body } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { AdminLoginDto } from './dto/admin-login.dto';

// Staff accounts are created through POST /admin/staff (AdminController). There used to be a second,
// duplicate creation route here; two implementations of one privileged action drift apart.
@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  adminLogin(@Body() dto: AdminLoginDto) {
    return this.authService.adminLogin(dto);
  }
}
