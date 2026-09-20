import { MAX_UPLOAD_BYTES } from '../../common/constants/limits';

/**
 * Everything the upload endpoint can tell a customer. These reach the UI as-is, so they are
 * written for people, not developers. The frontend pre-check in pages/app/new-job.vue repeats
 * the "unsupported" and "too large" wording so it can answer before uploading anything.
 */
export const UPLOAD_MESSAGES = {
  unsupportedType: "We can't accept that file. Please upload a PDF, a Word document (.doc or .docx), or a JPEG or PNG image.",
  tooLarge: `That file is too large. The maximum size is ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB.`,
  noFile: 'Please choose a file to upload.',
  badPdf: "We couldn't read that PDF. It may be damaged or password-protected. Please try another copy.",
  conversionFailed: "We couldn't convert that document to PDF. Check that it opens normally, or save it as a PDF and upload that instead.",
  badUpload: "That upload didn't look right. Please choose the file again.",
} as const;
