import { IsEnum } from 'class-validator';
import { JobStatus } from '../../jobs/models/job.model';

export class UpdateJobStatusDto {
  @IsEnum(JobStatus)
  status: JobStatus;
}
