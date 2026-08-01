import {
  Injectable, OnModuleInit, Logger, NotFoundException,
  BadRequestException, InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import { PDFParse } from 'pdf-parse';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';
import { tmpdir } from 'os';
import * as fs from 'fs/promises';
import { v4 as uuid } from 'uuid';
import { File } from './models/file.model';
import { User, UserRole } from '../users/models/user.model';

const execFileAsync = promisify(execFile);

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

@Injectable()
export class FilesService implements OnModuleInit {
  private readonly logger = new Logger(FilesService.name);
  private readonly client: Minio.Client;
  private readonly publicClient: Minio.Client;
  private readonly bucket: string;

  constructor(
    @InjectModel(File) private readonly fileModel: typeof File,
    private readonly config: ConfigService,
  ) {
    this.bucket = this.config.get('MINIO_BUCKET') ?? 'printease';

    // Used for the backend's own storage operations (putObject, bucketExists, ...).
    // Reaches MinIO over the internal Docker network, e.g. MINIO_ENDPOINT=minio.
    this.client = new Minio.Client({
      endPoint:  this.config.get('MINIO_ENDPOINT') ?? 'localhost',
      port:      Number(this.config.get('MINIO_PORT') ?? 9000),
      useSSL:    this.config.get('MINIO_USE_SSL') === 'true',
      accessKey: this.config.get('MINIO_ACCESS_KEY') ?? 'minioadmin',
      secretKey: this.config.get('MINIO_SECRET_KEY') ?? 'minioadmin',
    });

    // Used only to build presigned URLs, which are followed by a browser, not
    // this container — must point at a host the browser can actually reach
    // (e.g. localhost or a LAN IP), which may differ from MINIO_ENDPOINT.
    this.publicClient = new Minio.Client({
      endPoint:  this.config.get('MINIO_PUBLIC_ENDPOINT') || this.config.get('MINIO_ENDPOINT') || 'localhost',
      port:      Number(this.config.get('MINIO_PUBLIC_PORT') || this.config.get('MINIO_PORT') || 9000),
      useSSL:    (this.config.get('MINIO_PUBLIC_USE_SSL') || this.config.get('MINIO_USE_SSL')) === 'true',
      accessKey: this.config.get('MINIO_ACCESS_KEY') ?? 'minioadmin',
      secretKey: this.config.get('MINIO_SECRET_KEY') ?? 'minioadmin',
    });
  }

  async onModuleInit() {
    try {
      const exists = await this.client.bucketExists(this.bucket);
      if (!exists) {
        await this.client.makeBucket(this.bucket);
        this.logger.log(`Created MinIO bucket: ${this.bucket}`);
      }
    } catch (err) {
      this.logger.warn(`MinIO init failed (is MinIO running?): ${errorMessage(err)}`);
    }
  }

  async processUpload(file: Express.Multer.File, userId: string) {
    const ext        = file.originalname.split('.').pop()?.toLowerCase() ?? 'bin';
    const id         = uuid();
    const storedName = `${id}.${ext}`;
    const fileKey    = `originals/${userId}/${storedName}`;

    // Upload original to MinIO
    await this.client.putObject(this.bucket, fileKey, file.buffer, file.size, {
      'Content-Type': file.mimetype,
    });

    let pdfKey: string | null = null;
    let pageCount = 1;

    if (file.mimetype === 'application/pdf') {
      pdfKey    = fileKey;
      pageCount = await this.getPdfPageCount(file.buffer);
    } else if (this.isConvertibleDocument(file.mimetype)) {
      const pdfBuffer = await this.convertToPdf(file.buffer, ext, id);
      pdfKey = `pdfs/${userId}/${id}.pdf`;
      await this.client.putObject(this.bucket, pdfKey, pdfBuffer, pdfBuffer.length, {
        'Content-Type': 'application/pdf',
      });
      pageCount = await this.getPdfPageCount(pdfBuffer);
    }
    // images (jpg/png): pageCount stays 1, pdfKey stays null

    const record = await this.fileModel.create({
      userId,
      originalName: file.originalname,
      storedName,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      pageCount,
      fileKey,
      pdfKey,
    });

    return {
      fileId:       record.id,
      fileName:     record.originalName,
      pageCount:    record.pageCount,
      mimeType:     record.mimeType,
      sizeBytes:    record.sizeBytes,
      fileKey:      record.fileKey,
    };
  }

  private isConvertibleDocument(mimeType: string): boolean {
    return mimeType === 'application/msword'
      || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }

  private async getPdfPageCount(buffer: Buffer): Promise<number> {
    const parser = new PDFParse({ data: buffer });
    try {
      const info = await parser.getInfo({ parsePageInfo: true });
      if (!info.total || info.total < 1) throw new Error('No pages detected');
      return info.total;
    } catch (err) {
      this.logger.error(`PDF page count failed: ${errorMessage(err)}`);
      throw new BadRequestException('Unable to read PDF — the file may be corrupted or encrypted');
    } finally {
      await parser.destroy();
    }
  }

  private async convertToPdf(buffer: Buffer, ext: string, id: string): Promise<Buffer> {
    const workDir    = join(tmpdir(), `lo-${id}`);
    const profileDir = join(workDir, 'profile');
    const tmpIn      = join(workDir, `${id}.${ext}`);
    const tmpOut     = join(workDir, `${id}.pdf`);

    await fs.mkdir(workDir, { recursive: true });
    await fs.writeFile(tmpIn, buffer);

    try {
      await execFileAsync('soffice', [
        '--headless', '--norestore',
        `-env:UserInstallation=file://${profileDir}`,
        '--convert-to', 'pdf',
        '--outdir', workDir,
        tmpIn,
      ], { timeout: 60_000 });
      return await fs.readFile(tmpOut);
    } catch (err) {
      this.logger.error(`LibreOffice conversion failed: ${errorMessage(err)}`);
      throw new InternalServerErrorException('Document conversion failed');
    } finally {
      await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  async getPresignedUrl(fileId: string, user: User) {
    const file = await this.fileModel.findOne({ where: { id: fileId } });
    if (!file) throw new NotFoundException('File not found');
    const isBypass = user.role === UserRole.ADMIN || user.role === UserRole.CLERK;
    if (file.userId !== user.id && !isBypass) throw new NotFoundException('File not found');

    const key = file.pdfKey ?? file.fileKey;
    const url = await this.publicClient.presignedGetObject(this.bucket, key, 3600);
    return { url };
  }

  async getPresignedUrlForAdmin(fileId: string): Promise<string> {
    const file = await this.fileModel.findOne({ where: { id: fileId } });
    if (!file) throw new NotFoundException('File not found');
    const key = file.pdfKey ?? file.fileKey;
    return this.publicClient.presignedGetObject(this.bucket, key, 3600);
  }
}
