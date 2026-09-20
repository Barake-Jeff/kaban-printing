import {
  Controller, Get, Post, Patch, Body, Param, ParseUUIDPipe, Query, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { parsePagination } from '../../common/utils/pagination.util';
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

// Clerks run the counter: the queue, job status/payment/notes/files, customers and the dashboard.
// Everything that configures the business or exposes its finances or staff (settings, staff, reports,
// password resets) carries its own @Roles(UserRole.ADMIN), which overrides this class-level default.
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CLERK, UserRole.ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ── Queue & Stats ──────────────────────────────────────────────────────────

  @Get('jobs')
  getQueue(
    @Query('status') status?: string,
    @Query('page')   page?: string,
    @Query('size')   size?: string,
  ) {
    const p = parsePagination(page, size, { defaultSize: 50 });
    return this.adminService.getQueue(status, p.page, p.size);
  }

  @Get('stats')
  getStats() {
    return this.adminService.getStats();
  }

  // ── Customers ──────────────────────────────────────────────────────────────

  @Get('customers')
  getCustomers(
    @Query('page')   page?: string,
    @Query('size')   size?: string,
    @Query('search') search?: string,
  ) {
    return this.adminService.getCustomers(parsePagination(page, size, { defaultSize: 24 }), search);
  }

  // Must stay ahead of 'customers/:id', or "lookup" gets matched as an id.
  @Get('customers/lookup')
  lookupCustomer(@Query('house') house: string) {
    return this.adminService.lookupCustomer(house);
  }

  @Get('customers/:id')
  getCustomer(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.getCustomer(id);
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

  // Soft-cancel (replaces the old hard DELETE): the job stays on record marked cancelled.
  @Patch('jobs/:id/cancel')
  cancelJob(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.adminService.cancelJob(id, user);
  }

  @Get('jobs/:id/file')
  getJobFile(@Param('id') id: string) {
    return this.adminService.getFileUrl(id);
  }

  // ── Staff (admin only) ─────────────────────────────────────────────────────

  @Get('staff')
  @Roles(UserRole.ADMIN)
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
  deactivateStaff(@Param('id') id: string, @CurrentUser() user: User) {
    return this.adminService.deactivateStaff(id, user);
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
  @Roles(UserRole.ADMIN)
  getSettings() {
    return this.adminService.getSettings();
  }

  @Patch('settings')
  @Roles(UserRole.ADMIN)
  saveSettings(@Body() dto: SaveSettingsDto) {
    return this.adminService.saveSettings(dto);
  }

  // ── Reports ────────────────────────────────────────────────────────────────

  @Get('reports')
  @Roles(UserRole.ADMIN)
  getReports() {
    return this.adminService.getReports();
  }
}
