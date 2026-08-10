# File Handling — Upload, Conversion & Serving

> Storage: MinIO (S3-compatible). Files are never written to the container's local disk
> permanently. The pipeline is: receive buffer → convert in /tmp → upload to MinIO → store key in DB.
> Presigned URLs are generated on demand; nothing is served from local disk.

---

## Accepted file types

| MIME type                                                               | Extension  | Convert to PDF? |
|-------------------------------------------------------------------------|------------|-----------------|
| `application/pdf`                                                       | .pdf       | No              |
| `application/msword`                                                    | .doc       | Yes             |
| `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | .docx   | Yes             |
| `image/jpeg`                                                            | .jpg/.jpeg | Yes             |
| `image/png`                                                             | .png       | Yes             |

Reject any other MIME type with `400 Bad Request`.

---

## File size limit

- Maximum: `20MB` per file
- Enforced via `MaxFileSizeValidator` in NestJS pipe
- Return `413 Payload Too Large` if exceeded

---

## MinIO bucket layout

```
printease/              ← bucket name (from MINIO_BUCKET env var)
  originals/
    {userId}/
      {uuid}{ext}       ← raw uploaded file
  pdfs/
    {userId}/
      {uuid}.pdf        ← converted PDF
```

Object keys (stored in DB):
- `file_key` → `originals/{userId}/{uuid}{ext}`
- `pdf_key`  → `pdfs/{userId}/{uuid}.pdf`

---

## Controller

Use `memoryStorage` — file arrives as `file.buffer` in memory, never touches disk.

```typescript
// files.controller.ts
import {
  Controller, Post, Get, Param, UseInterceptors, UploadedFile,
  UseGuards, ParseFilePipe, MaxFileSizeValidator, FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { FilesService } from './files.service';

@Controller('files')
@UseGuards(JwtAuthGuard)
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  uploadFile(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 20 * 1024 * 1024 }),
          new FileTypeValidator({
            fileType: /(pdf|msword|wordprocessingml|jpeg|jpg|png)/,
          }),
        ],
      }),
    )
    file: Express.Multer.File,
    @CurrentUser() user,
  ) {
    return this.filesService.processUpload(file, user.id);
  }

  @Get(':fileId')
  getFileUrl(@Param('fileId') fileId: string, @CurrentUser() user) {
    return this.filesService.getPresignedUrl(fileId, user.id);
  }
}
```

---

## Files service

```typescript
// files.service.ts
import {
  Injectable, InternalServerErrorException, NotFoundException, ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { ConfigService } from '@nestjs/config';
import { exec } from 'child_process';
import { promisify } from 'util';
import { extname, basename, join } from 'path';
import { tmpdir } from 'os';
import * as fs from 'fs/promises';
import * as Minio from 'minio';
import { v4 as uuidv4 } from 'uuid';
import * as pdfParse from 'pdf-parse';
import { File } from './models/file.model';

const execAsync = promisify(exec);

@Injectable()
export class FilesService {
  private readonly minioClient: Minio.Client;
  private readonly bucket: string;

  constructor(
    @InjectModel(File)
    private readonly fileModel: typeof File,
    private readonly config: ConfigService,
  ) {
    this.bucket = this.config.get<string>('MINIO_BUCKET');
    this.minioClient = new Minio.Client({
      endPoint:  this.config.get<string>('MINIO_ENDPOINT'),
      port:      parseInt(this.config.get<string>('MINIO_PORT'), 10),
      useSSL:    this.config.get<string>('MINIO_USE_SSL') === 'true',
      accessKey: this.config.get<string>('MINIO_ACCESS_KEY'),
      secretKey: this.config.get<string>('MINIO_SECRET_KEY'),
    });
  }

  async processUpload(file: Express.Multer.File, userId: string) {
    const uuid = uuidv4();
    const ext  = extname(file.originalname);

    // Upload original to MinIO
    const fileKey = `originals/${userId}/${uuid}${ext}`;
    await this.minioClient.putObject(this.bucket, fileKey, file.buffer, file.size, {
      'Content-Type': file.mimetype,
    });

    // Convert to PDF if needed; upload PDF to MinIO
    let pdfKey: string;
    let pageCount = 1;

    if (file.mimetype === 'application/pdf') {
      pdfKey    = fileKey;
      pageCount = await this.getPdfPageCount(file.buffer);
    } else {
      const pdfBuffer = await this.convertToPdf(file.buffer, ext);
      pdfKey = `pdfs/${userId}/${uuid}.pdf`;
      await this.minioClient.putObject(this.bucket, pdfKey, pdfBuffer, pdfBuffer.length, {
        'Content-Type': 'application/pdf',
      });
      pageCount = await this.getPdfPageCount(pdfBuffer);
    }

    // Persist record — store keys, not URLs
    const record = await this.fileModel.create({
      userId,
      originalName: file.originalname,
      storedName:   `${uuid}${ext}`,
      mimeType:     file.mimetype,
      sizeBytes:    file.size,
      pageCount,
      fileKey,
      pdfKey,
    });

    // Return presigned URLs valid for 1 hour
    const fileUrl = await this.minioClient.presignedGetObject(this.bucket, fileKey, 3600);
    const pdfUrl  = await this.minioClient.presignedGetObject(this.bucket, pdfKey,  3600);

    return { fileId: record.id, fileName: file.originalname, fileUrl, pdfUrl, pageCount };
  }

  async getPresignedUrl(fileId: string, userId: string) {
    const file = await this.fileModel.findOne({ where: { id: fileId } });
    if (!file) throw new NotFoundException('File not found');
    if (file.userId !== userId) throw new ForbiddenException();

    const url = await this.minioClient.presignedGetObject(this.bucket, file.pdfKey, 3600);
    return { url };
  }

  // Write buffer to /tmp, run LibreOffice, read output, clean up
  private async convertToPdf(buffer: Buffer, ext: string): Promise<Buffer> {
    const id        = uuidv4();
    const tmpIn     = join(tmpdir(), `${id}${ext}`);
    const tmpOut    = join(tmpdir(), `${id}.pdf`);

    await fs.writeFile(tmpIn, buffer);

    try {
      const cmd = `libreoffice --headless --convert-to pdf --outdir "${tmpdir()}" "${tmpIn}"`;
      await execAsync(cmd, { timeout: 30_000 });
      return await fs.readFile(tmpOut);
    } catch {
      throw new InternalServerErrorException('File conversion failed');
    } finally {
      await fs.unlink(tmpIn).catch(() => {});
      await fs.unlink(tmpOut).catch(() => {});
    }
  }

  private async getPdfPageCount(buffer: Buffer): Promise<number> {
    try {
      const data = await pdfParse(buffer);
      return data.numpages;
    } catch {
      return 1;
    }
  }
}
```

---

## File model

```typescript
// models/file.model.ts
import { Table, Column, Model, DataType, ForeignKey } from 'sequelize-typescript';
import { User } from '../../users/models/user.model';

@Table({ tableName: 'files', timestamps: false })
export class File extends Model {
  @Column({ type: DataType.UUID, defaultValue: DataType.UUIDV4, primaryKey: true })
  id: string;

  @ForeignKey(() => User)
  @Column({ type: DataType.UUID, allowNull: false, field: 'user_id' })
  userId: string;

  @Column({ type: DataType.STRING(500), allowNull: false, field: 'original_name' })
  originalName: string;

  @Column({ type: DataType.STRING(500), allowNull: false, field: 'stored_name' })
  storedName: string;

  @Column({ type: DataType.STRING(100), allowNull: false, field: 'mime_type' })
  mimeType: string;

  @Column({ type: DataType.INTEGER, allowNull: false, field: 'size_bytes' })
  sizeBytes: number;

  @Column({ type: DataType.INTEGER, defaultValue: 1, field: 'page_count' })
  pageCount: number;

  @Column({ type: DataType.STRING(1000), allowNull: false, field: 'file_key' })
  fileKey: string;

  @Column({ type: DataType.STRING(1000), allowNull: true, field: 'pdf_key' })
  pdfKey: string;

  @Column({ type: DataType.DATE, defaultValue: DataType.NOW, field: 'created_at' })
  createdAt: Date;
}
```

---

## LibreOffice in Docker

Add to `kaban-backend/Dockerfile` stage 2:

```dockerfile
# Install LibreOffice for PDF conversion
RUN apk add --no-cache libreoffice openjdk17-jre font-noto
```

`apk` is Alpine's package manager (the base image is `node:24-alpine`).

---

## Bucket initialisation

Create the bucket on first run. Add this to `FilesService.onModuleInit()`:

```typescript
async onModuleInit() {
  const exists = await this.minioClient.bucketExists(this.bucket);
  if (!exists) {
    await this.minioClient.makeBucket(this.bucket, 'us-east-1');
  }
}
```

Implement `OnModuleInit` from `@nestjs/common`.

---

## What the frontend expects from POST /api/files/upload

```typescript
{
  statusCode: 200,
  message: 'Success',
  data: {
    fileId:    'uuid',
    fileName:  'document.pdf',
    fileUrl:   'https://minio:9000/printease/originals/.../uuid.pdf?X-Amz-...',
    pdfUrl:    'https://minio:9000/printease/pdfs/.../uuid.pdf?X-Amz-...',
    pageCount: 4,
  }
}
```

Presigned URLs expire after 1 hour. The frontend should use them immediately for display/preview only.

---

## npm packages required

```bash
npm install minio
npm install multer @types/multer
npm install pdf-parse @types/pdf-parse
npm install uuid @types/uuid
npm install @nestjs/platform-express
```

---

## Security rules

- Never trust client-provided filenames — use the UUID-based `storedName`
- Never expose raw MinIO keys in API responses — always return presigned URLs
- Presigned URLs expire in 1 hour — the frontend must not cache them long-term
- Validate MIME type from actual file content (Multer does this), not just the extension
- Ownership check before generating any presigned URL
