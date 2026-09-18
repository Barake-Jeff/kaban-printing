import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User, UserRole } from '../users/models/user.model';
import { AdminService } from './admin.service';
import { UpdateJobStatusDto } from './dto/update-job-status.dto';
import { SaveNotesDto } from './dto/save-notes.dto';
import { CreateStaffDto } from './dto/create-staff.dto';
import { SaveSettingsDto } from './dto/save-settings.dto';
import { SetUserPasswordDto } from './dto/set-user-password.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CLERK, UserRole.ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ── Queue & Stats ──────────────────────────────────────────────────────────

  @Get('jobs')
  getQueue(
    @Query('status') status?: string,
    @Query('page')   page = '1',
    @Query('size')   size = '50',
  ) {
    return this.adminService.getQueue(status, Number(page), Number(size));
  }

  @Get('stats')
  getStats() {
    return this.adminService.getStats();
  }

  // ── Customers ──────────────────────────────────────────────────────────────

  @Get('customers')
  getCustomers() {
    return this.adminService.getCustomers();
  }

  @Get('customers/lookup')
  lookupCustomer(@Query('house') house: string) {
    return this.adminService.lookupCustomer(house);
  }

  // ── Job mutations ──────────────────────────────────────────────────────────

  @Patch('jobs/:id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateJobStatusDto) {
    return this.adminService.updateStatus(id, dto);
  }

  @Patch('jobs/:id/payment')
  markAsPaid(@Param('id') id: string) {
    return this.adminService.markAsPaid(id);
  }

  @Patch('jobs/:id/notes')
  saveNotes(@Param('id') id: string, @Body() dto: SaveNotesDto) {
    return this.adminService.saveNotes(id, dto);
  }

  @Delete('jobs/:id')
  cancelJob(@Param('id') id: string) {
    return this.adminService.cancelJob(id);
  }

  @Get('jobs/:id/file')
  getJobFile(@Param('id') id: string) {
    return this.adminService.getFileUrl(id);
  }

  // ── Staff (admin only) ─────────────────────────────────────────────────────

  @Get('staff')
  getStaff() {
    return this.adminService.getStaff();
  }

  @Post('staff')
  @Roles(UserRole.ADMIN)
  createStaff(@Body() dto: CreateStaffDto) {
    return this.adminService.createStaffMember(dto);
  }

  @Patch('staff/:id/deactivate')
  @Roles(UserRole.ADMIN)
  deactivateStaff(@Param('id') id: string) {
    return this.adminService.deactivateStaff(id);
  }

  @Patch('staff/:id/reactivate')
  @Roles(UserRole.ADMIN)
  reactivateStaff(@Param('id') id: string) {
    return this.adminService.reactivateStaff(id);
  }

  // ── Password reset requests (admin only) ────────────────────────────────────

  @Get('password-reset-requests')
  @Roles(UserRole.ADMIN)
  getPasswordResetRequests() {
    return this.adminService.getPasswordResetRequests();
  }

  @Patch('password-reset-requests/:id/dismiss')
  @Roles(UserRole.ADMIN)
  dismissPasswordResetRequest(@Param('id') id: string, @CurrentUser() user: User) {
    return this.adminService.dismissPasswordResetRequest(id, user);
  }

  @Patch('users/:id/password')
  @Roles(UserRole.ADMIN)
  setUserPassword(@Param('id') id: string, @Body() dto: SetUserPasswordDto, @CurrentUser() user: User) {
    return this.adminService.setUserPassword(id, dto, user);
  }

  // ── Settings ───────────────────────────────────────────────────────────────

  @Get('settings')
  getSettings() {
    return this.adminService.getSettings();
  }

  @Patch('settings')
  saveSettings(@Body() dto: SaveSettingsDto) {
    return this.adminService.saveSettings(dto);
  }

  // ── Reports ────────────────────────────────────────────────────────────────

  @Get('reports')
  getReports() {
    return this.adminService.getReports();
  }
}
