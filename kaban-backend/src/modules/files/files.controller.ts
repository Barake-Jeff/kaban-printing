import {
  Controller, Post, Get, Param, UseGuards,
  UseInterceptors, UploadedFile, ParseFilePipe,
  MaxFileSizeValidator, FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { memoryStorage } from 'multer';
import { MAX_UPLOAD_BYTES } from '../../common/constants/limits';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OwnershipGuard } from '../../common/guards/ownership.guard';
import { CheckOwnership } from '../../common/decorators/check-ownership.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { FilesService } from './files.service';
import { File } from './models/file.model';
import { User, UserRole } from '../users/models/user.model';

@Controller('files')
@UseGuards(JwtAuthGuard)
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('upload')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    // Enforced while the stream is read, so an oversized upload is aborted (413) instead of
    // being buffered in full before ParseFilePipe gets a chance to reject it. The other
    // limits bound what a multipart body can carry besides the one file.
    limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 2, parts: 3, fieldSize: 1024 },
  }))
  uploadFile(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_UPLOAD_BYTES }),
          new FileTypeValidator({ fileType: /(pdf|msword|officedocument\.wordprocessingml|jpeg|jpg|png)/i }),
        ],
      }),
    )
    file: Express.Multer.File,
    @CurrentUser() user: User,
  ) {
    return this.filesService.processUpload(file, user.id);
  }

  @Get(':fileId')
  @UseGuards(OwnershipGuard)
  @CheckOwnership({ model: File, idParam: 'fileId', bypassRoles: [UserRole.ADMIN, UserRole.CLERK] })
  getFileUrl(@Param('fileId') fileId: string, @CurrentUser() user: User) {
    return this.filesService.getPresignedUrl(fileId, user);
  }
}
