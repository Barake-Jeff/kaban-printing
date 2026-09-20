import {
  BadRequestException, CallHandler, ExecutionContext, Injectable, PayloadTooLargeException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Observable } from 'rxjs';
import { MAX_UPLOAD_BYTES } from '../../common/constants/limits';
import { UPLOAD_MESSAGES } from './upload-messages';

const MulterFileInterceptor = FileInterceptor('file', {
  storage: memoryStorage(),
  // Enforced while the stream is read, so an oversized upload is aborted (413) instead of being
  // buffered in full first. The other limits bound what a multipart body can carry besides the
  // one file.
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 2, parts: 3, fieldSize: 1024 },
});

/**
 * The standard single-file interceptor, except that the errors multer raises while reading the
 * upload ("File too large", "Too many fields", "Unexpected field"...) are replaced with messages a
 * customer can act on. Only the multer stage is wrapped: `intercept` resolves once the body has
 * been read, so anything the route handler throws later is untouched.
 */
@Injectable()
export class UploadFileInterceptor extends MulterFileInterceptor {
  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    try {
      return await super.intercept(context, next);
    } catch (err) {
      if (err instanceof PayloadTooLargeException) throw new PayloadTooLargeException(UPLOAD_MESSAGES.tooLarge);
      if (err instanceof BadRequestException) throw new BadRequestException(UPLOAD_MESSAGES.badUpload);
      throw err;
    }
  }
}
