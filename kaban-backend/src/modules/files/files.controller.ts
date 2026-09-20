import {
  BadRequestException, Controller, Post, Get, Param, UseGuards,
  UseInterceptors, UploadedFile,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OwnershipGuard } from '../../common/guards/ownership.guard';
import { CheckOwnership } from '../../common/decorators/check-ownership.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestAbortSignal } from '../../common/decorators/request-abort-signal.decorator';
import { FilesService } from './files.service';
import { UploadFileInterceptor } from './upload-file.interceptor';
import { UPLOAD_MESSAGES } from './upload-messages';
import { File } from './models/file.model';
import { User, UserRole } from '../users/models/user.model';

@Controller('files')
@UseGuards(JwtAuthGuard)
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('upload')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseInterceptors(UploadFileInterceptor)
  uploadFile(
    // Size is enforced by the interceptor's multer limit; what the file actually is gets
    // decided from its bytes in FilesService (never from the declared MIME type).
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: User,
    @RequestAbortSignal() signal: AbortSignal,
  ) {
    if (!file) throw new BadRequestException(UPLOAD_MESSAGES.noFile);
    return this.filesService.processUpload(file, user.id, signal);
  }

  @Get(':fileId')
  @UseGuards(OwnershipGuard)
  @CheckOwnership({ model: File, idParam: 'fileId', bypassRoles: [UserRole.ADMIN, UserRole.CLERK] })
  getFileUrl(@Param('fileId') fileId: string, @CurrentUser() user: User) {
    return this.filesService.getPresignedUrl(fileId, user);
  }
}
