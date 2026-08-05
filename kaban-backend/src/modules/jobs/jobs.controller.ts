import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
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
  create(@Body() dto: CreateJobDto, @CurrentUser() user: User) {
    return this.jobsService.create(dto, user);
  }

  @Get('my-jobs')
  getMyJobs(
    @CurrentUser() user: User,
    @Query('page') page = '1',
    @Query('size') size = '10',
  ) {
    return this.jobsService.findMyJobs(user.id, Number(page), Number(size));
  }

  @Get(':id')
  @UseGuards(OwnershipGuard)
  @CheckOwnership({ model: Job, idParam: 'id', bypassRoles: [UserRole.ADMIN, UserRole.CLERK] })
  getOne(@Param('id') id: string, @CurrentUser() user: User) {
    return this.jobsService.findOne(id, user);
  }
}
