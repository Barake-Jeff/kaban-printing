// Resource-consumption ceilings (OWASP API4). Keep the frontend in step with these:
// new-job.vue caps the copies stepper and the instructions textarea to match.

export const MAX_PAGE_SIZE = 100;
export const MAX_PAGE = 100_000;

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

// Rolling 24h windows, per user.
export const QUOTA_WINDOW_MS = 24 * 60 * 60 * 1000;
export const MAX_UPLOADS_PER_DAY = 50;
export const MAX_JOBS_PER_DAY = 100;

// Each DOCX conversion is a full LibreOffice process; run a couple at a time, queue a few.
export const MAX_CONCURRENT_CONVERSIONS = 2;
export const MAX_QUEUED_CONVERSIONS = 10;

export const MAX_COPIES = 1000;
export const MAX_INSTRUCTIONS_LENGTH = 2000;
