import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { parsePagination } from '../../common/utils/pagination.util';
import { OwnershipGuard } from '../../common/guards/ownership.guard';
import { CheckOwnership } from '../../common/decorators/check-ownership.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JobsService } from './jobs.service';
import { CreateJobDto } from './dto/create-job.dto';
import { Job } from './models/job.model';
import { User, UserRole } from '../users/models/user.model';

@Controller('jobs')
@UseGuards(JwtAuthGuard)
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Post()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  create(@Body() dto: CreateJobDto, @CurrentUser() user: User) {
    return this.jobsService.create(dto, user);
  }

  @Get('my-jobs')
  getMyJobs(
    @CurrentUser() user: User,
    @Query('page') page?: string,
    @Query('size') size?: string,
  ) {
    const p = parsePagination(page, size, { defaultSize: 10 });
    return this.jobsService.findMyJobs(user.id, p.page, p.size);
  }

  // Must stay ahead of the ':id' route below, or "pricing" gets matched as an id.
  @Get('pricing')
  getPricing() {
    return this.jobsService.getPricing();
  }

  @Get(':id')
  @UseGuards(OwnershipGuard)
  @CheckOwnership({ model: Job, idParam: 'id', bypassRoles: [UserRole.ADMIN, UserRole.CLERK] })
  getOne(@Param('id') id: string, @CurrentUser() user: User) {
    return this.jobsService.findOne(id, user);
  }
}
