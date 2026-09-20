import {
  Injectable, OnModuleInit, Logger, NotFoundException,
  BadRequestException, InternalServerErrorException,
  HttpException, HttpStatus, ServiceUnavailableException, UnsupportedMediaTypeException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import { PDFParse } from 'pdf-parse';
import { spawn } from 'child_process';
import { join } from 'path';
import { tmpdir } from 'os';
import * as fs from 'fs/promises';
import { v4 as uuid } from 'uuid';
import { File } from './models/file.model';
import { User, UserRole } from '../users/models/user.model';
import {
  MAX_UPLOADS_PER_DAY, QUOTA_WINDOW_MS,
  MAX_CONCURRENT_CONVERSIONS, MAX_QUEUED_CONVERSIONS,
} from '../../common/constants/limits';
import {
  ConcurrencyLimiter, LimiterFullError, OperationAbortedError,
} from '../../common/utils/concurrency-limiter.util';
import { detectUploadType } from '../../common/utils/upload-type.util';
import { UPLOAD_MESSAGES } from './upload-messages';

const CONVERSION_TIMEOUT_MS = 60_000;

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Content-Disposition for a staff download. The name comes from the customer's original
 * filename, so it is stripped of anything that could break out of the header, with an ASCII
 * fallback plus the RFC 5987 UTF-8 form for browsers that understand it.
 */
function attachmentDisposition(name: string): string {
  const clean = name.replace(/[\x00-\x1f\x7f"\\/]/g, '_').trim().slice(0, 200) || 'document';
  const ascii = clean.replace(/[^\x20-\x7e]/g, '_');
  const utf8  = encodeURIComponent(clean).replace(/['()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${utf8}`;
}

@Injectable()
export class FilesService implements OnModuleInit {
  private readonly logger = new Logger(FilesService.name);
  private readonly conversionLimiter = new ConcurrencyLimiter(MAX_CONCURRENT_CONVERSIONS, MAX_QUEUED_CONVERSIONS);
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
    // The region is pinned because without it the client first asks that host for the
    // bucket's region over the network — from inside this container a browser-facing
    // address like localhost:9000 refuses the connection and every presign fails with a 500.
    // A pinned region makes presigning a local calculation.
    this.publicClient = new Minio.Client({
      endPoint:  this.config.get('MINIO_PUBLIC_ENDPOINT') || this.config.get('MINIO_ENDPOINT') || 'localhost',
      port:      Number(this.config.get('MINIO_PUBLIC_PORT') || this.config.get('MINIO_PORT') || 9000),
      useSSL:    (this.config.get('MINIO_PUBLIC_USE_SSL') || this.config.get('MINIO_USE_SSL')) === 'true',
      accessKey: this.config.get('MINIO_ACCESS_KEY') ?? 'minioadmin',
      secretKey: this.config.get('MINIO_SECRET_KEY') ?? 'minioadmin',
      region:    this.config.get('MINIO_REGION') || 'us-east-1',
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

  /**
   * `signal` fires if the client disconnects mid-request (see RequestAbortSignal). An abandoned
   * upload is dropped from the conversion queue or its LibreOffice run is killed, and nothing
   * is stored.
   */
  async processUpload(file: Express.Multer.File, userId: string, signal?: AbortSignal) {
    try {
      return await this.storeUpload(file, userId, signal);
    } catch (err) {
      // 499 ("client closed request") only shows up in the server log; the client is gone.
      if (err instanceof OperationAbortedError) throw new HttpException('Upload cancelled', 499);
      throw err;
    }
  }

  private async storeUpload(file: Express.Multer.File, userId: string, signal?: AbortSignal) {
    // What the file really is, from its bytes. The MIME type the browser declared and the
    // customer's filename are never trusted: a Word file labelled image/png must still be
    // converted and billed by its real page count, and a filename must not choose the stored
    // name or extension. Checked first so a bad file costs no database query.
    const detected = detectUploadType(file.buffer);
    if (!detected) throw new UnsupportedMediaTypeException(UPLOAD_MESSAGES.unsupportedType);

    // Checked before touching MinIO or LibreOffice. Concurrent requests can overshoot by
    // at most the per-minute throttle, which is fine for a cost cap.
    const recentUploads = await this.fileModel.count({
      where: { userId, createdAt: { [Op.gte]: new Date(Date.now() - QUOTA_WINDOW_MS) } },
    });
    if (recentUploads >= MAX_UPLOADS_PER_DAY) {
      throw new HttpException('Daily upload limit reached. Please try again tomorrow.', HttpStatus.TOO_MANY_REQUESTS);
    }

    const id         = uuid();
    const storedName = `${id}.${detected.ext}`;
    const fileKey    = `originals/${userId}/${storedName}`;

    // Everything that can fail or be cancelled (reading the PDF, converting Word) happens
    // before anything is written to MinIO, so a bad or abandoned upload leaves nothing behind.
    let pdfBuffer: Buffer | null = null;
    let pdfKey: string | null = null;
    let pageCount = 1;

    if (detected.kind === 'pdf') {
      pdfKey    = fileKey;
      pageCount = await this.getPdfPageCount(file.buffer);
    } else if (detected.kind === 'word') {
      pdfBuffer = await this.runConversion(() => this.convertToPdf(file.buffer, detected.ext, id, signal), signal);
      pdfKey    = `pdfs/${userId}/${id}.pdf`;
      pageCount = await this.getPdfPageCount(pdfBuffer);
    }
    // images (jpg/png): pageCount stays 1, pdfKey stays null

    if (signal?.aborted) throw new OperationAbortedError();

    const stored: string[] = [];
    try {
      await this.client.putObject(this.bucket, fileKey, file.buffer, file.size, {
        'Content-Type': detected.mime,
      });
      stored.push(fileKey);

      if (pdfBuffer && pdfKey) {
        await this.client.putObject(this.bucket, pdfKey, pdfBuffer, pdfBuffer.length, {
          'Content-Type': 'application/pdf',
        });
        stored.push(pdfKey);
      }

      if (signal?.aborted) throw new OperationAbortedError();

      const record = await this.fileModel.create({
        userId,
        originalName: file.originalname,
        storedName,
        mimeType: detected.mime,
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
    } catch (err) {
      // Objects without a database row would be unreachable and never cleaned up.
      await Promise.allSettled(stored.map(key => this.client.removeObject(this.bucket, key)));
      throw err;
    }
  }

  private async getPdfPageCount(buffer: Buffer): Promise<number> {
    const parser = new PDFParse({ data: buffer });
    try {
      const info = await parser.getInfo({ parsePageInfo: true });
      if (!info.total || info.total < 1) throw new Error('No pages detected');
      return info.total;
    } catch (err) {
      this.logger.error(`PDF page count failed: ${errorMessage(err)}`);
      throw new BadRequestException(UPLOAD_MESSAGES.badPdf);
    } finally {
      await parser.destroy();
    }
  }

  private async runConversion(task: () => Promise<Buffer>, signal?: AbortSignal): Promise<Buffer> {
    try {
      return await this.conversionLimiter.run(task, signal);
    } catch (err) {
      if (err instanceof LimiterFullError) {
        throw new ServiceUnavailableException('Server is busy converting documents, please retry shortly');
      }
      throw err;
    }
  }

  private async convertToPdf(buffer: Buffer, ext: string, id: string, signal?: AbortSignal): Promise<Buffer> {
    const workDir    = join(tmpdir(), `lo-${id}`);
    const profileDir = join(workDir, 'profile');
    const tmpIn      = join(workDir, `${id}.${ext}`);
    const tmpOut     = join(workDir, `${id}.pdf`);

    await fs.mkdir(workDir, { recursive: true });
    await fs.writeFile(tmpIn, buffer);

    try {
      await this.runSoffice([
        '--headless', '--norestore',
        `-env:UserInstallation=file://${profileDir}`,
        '--convert-to', 'pdf',
        '--outdir', workDir,
        tmpIn,
      ], signal);
      return await fs.readFile(tmpOut);
    } catch (err) {
      if (err instanceof OperationAbortedError) throw err;
      this.logger.error(`LibreOffice conversion failed: ${errorMessage(err)}`);
      throw new InternalServerErrorException(UPLOAD_MESSAGES.conversionFailed);
    } finally {
      await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  /**
   * Runs soffice in its own process group and kills the whole group on abort or timeout.
   * LibreOffice's launcher (oosplash) starts the real worker (soffice.bin) as a child, and
   * killing only the launcher would leave that worker running. Uses spawn rather than
   * execFile because execFile silently ignores `detached`, so it would not get its own group.
   */
  private runSoffice(args: string[], signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) return Promise.reject(new OperationAbortedError());

    return new Promise<void>((resolve, reject) => {
      const child = spawn('soffice', args, { detached: true, stdio: ['ignore', 'ignore', 'pipe'] });

      let stderr = '';
      child.stderr?.on('data', (chunk: Buffer) => {
        if (stderr.length < 2000) stderr += chunk.toString();
      });

      let aborted = false;
      let timedOut = false;
      const killGroup = () => {
        try {
          if (child.pid) process.kill(-child.pid, 'SIGKILL');
        } catch { /* already gone */ }
      };
      const onAbort = () => { aborted = true; killGroup(); };
      const timer = setTimeout(() => { timedOut = true; killGroup(); }, CONVERSION_TIMEOUT_MS);
      signal?.addEventListener('abort', onAbort, { once: true });
      const cleanup = () => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
      };

      child.once('error', err => { cleanup(); reject(err); });
      child.once('close', code => {
        cleanup();
        if (aborted)  return reject(new OperationAbortedError());
        if (timedOut) return reject(new Error(`timed out after ${CONVERSION_TIMEOUT_MS}ms`));
        if (code !== 0) return reject(new Error(`soffice exited with code ${code}: ${stderr.trim()}`));
        resolve();
      });
    });
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

  /**
   * Links for staff. `url` is what to print: for a converted Word document that is the
   * customer's original (LibreOffice can shift fonts and table layout), with the PDF the
   * customer previewed and was quoted from available as `pdfUrl`. Every other file has a single
   * link and `pdfUrl` is null.
   */
  async getAdminDownloadUrls(fileId: string): Promise<{ url: string; pdfUrl: string | null }> {
    const file = await this.fileModel.findOne({ where: { id: fileId } });
    if (!file) throw new NotFoundException('File not found');

    const isConverted = !!file.pdfKey && file.pdfKey !== file.fileKey;
    if (!isConverted) {
      const key = file.pdfKey ?? file.fileKey;
      return { url: await this.publicClient.presignedGetObject(this.bucket, key, 3600), pdfUrl: null };
    }

    // Without a download name the browser would save these as their storage keys (<uuid>.docx).
    const baseName = file.originalName.replace(/\.[^./\\]+$/, '') || 'document';
    const [url, pdfUrl] = await Promise.all([
      this.publicClient.presignedGetObject(this.bucket, file.fileKey, 3600, {
        'response-content-disposition': attachmentDisposition(file.originalName),
      }),
      this.publicClient.presignedGetObject(this.bucket, file.pdfKey!, 3600, {
        'response-content-disposition': attachmentDisposition(`${baseName}.pdf`),
      }),
    ]);
    return { url, pdfUrl };
  }
}
