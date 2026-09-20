import { IsIn } from 'class-validator';
import { JobStatus } from '../../jobs/models/job.model';

// The steps of the print workflow. 'cancelled' is deliberately not accepted here: cancelling has
// its own rules (which statuses may be cancelled, closing pending payments, who did it) and lives
// in PATCH /admin/jobs/:id/cancel, so this endpoint can't be used to sidestep them.
export const WORKFLOW_STATUSES = [
  JobStatus.PENDING, JobStatus.PRINTING, JobStatus.READY, JobStatus.DELIVERED,
];

export class UpdateJobStatusDto {
  @IsIn(WORKFLOW_STATUSES)
  status: JobStatus;
}
