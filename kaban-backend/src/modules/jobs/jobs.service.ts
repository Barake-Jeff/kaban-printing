import {
  Injectable, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Job, JobStatus, PaymentStatus } from './models/job.model';
import { File } from '../files/models/file.model';
import { User, UserRole } from '../users/models/user.model';
import { Setting } from '../admin/models/setting.model';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateJobDto } from './dto/create-job.dto';
import { getPricing } from '../../common/utils/pricing.util';
import { parsePageRange } from '../../common/utils/page-range.util';

const MAX_MANUAL_PAGES = 100;

@Injectable()
export class JobsService {
  constructor(
    @InjectModel(Job)     private readonly jobModel:     typeof Job,
    @InjectModel(File)    private readonly fileModel:    typeof File,
    @InjectModel(Setting) private readonly settingModel: typeof Setting,
    private readonly notificationsService: NotificationsService,
  ) {}

  /** Exposed via GET /jobs/pricing so the customer app can show a live estimate. */
  getPricing() {
    return getPricing(this.settingModel);
  }

  async create(dto: CreateJobDto, user: User) {
    if (!dto.fileId && !dto.instructions?.trim()) {
      throw new BadRequestException('Either a file or instructions must be provided');
    }

    let fileName: string | null = dto.fileName ?? null;
    let fileKey:  string | null = null;
    let pages = dto.pages;
    let totalPages: number | null = null;
    let pageSelection: string | null = null;

    if (dto.fileId) {
      const file = await this.fileModel.findOne({ where: { id: dto.fileId, userId: user.id } });
      if (!file) throw new NotFoundException('File not found');
      fileName   = file.originalName;
      fileKey    = file.fileKey;
      totalPages = file.pageCount;
      pages      = file.pageCount;

      if (dto.pageSelection?.trim()) {
        try {
          const parsed = parsePageRange(dto.pageSelection.trim(), file.pageCount);
          pages = parsed.pageCount;
          pageSelection = dto.pageSelection.trim();
        } catch (e: any) {
          throw new BadRequestException(e.message);
        }
      }
    } else if (dto.pages > MAX_MANUAL_PAGES) {
      throw new BadRequestException(`Manually entered page count cannot exceed ${MAX_MANUAL_PAGES}`);
    }

    const pricing     = await getPricing(this.settingModel);
    const perPage     = dto.colorMode === 'color' ? pricing.colorPerPage : pricing.bwPerPage;
    const sidesMult   = dto.sides === 'double' ? pricing.doubleSidedMultiplier : 1;
    const cost        = Math.round(pages * dto.copies * perPage * sidesMult);
    const deliveryFee = dto.deliveryType === 'delivery' ? pricing.deliveryFee : 0;

    const paymentStatus = dto.paymentMethod === 'pay_on_pickup'
      ? PaymentStatus.PAY_ON_PICKUP
      : PaymentStatus.UNPAID;

    const job = await this.jobModel.create({
      userId:       user.id,
      fileId:       dto.fileId ?? null,
      fileName,
      fileKey,
      instructions: dto.instructions ?? null,
      pages,
      totalPages,
      pageSelection,
      copies:       dto.copies,
      colorMode:    dto.colorMode,
      sides:        dto.sides,
      paperSize:    dto.paperSize,
      deliveryType: dto.deliveryType,
      paymentMethod: dto.paymentMethod,
      paymentStatus,
      status:        JobStatus.PENDING,
      cost,
      deliveryFee,
    });

    if (dto.paymentMethod === 'pay_on_pickup') {
      try {
        await this.notificationsService.send('job_received', {
          jobId: job.id, userId: user.id,
          user: {
            name: user.name, phone: user.phone, houseNumber: user.houseNumber,
            notifSms: user.notifSms, notifWhatsapp: user.notifWhatsapp,
          },
          job: { fileName, pages, copies: dto.copies, cost, deliveryFee, deliveryType: dto.deliveryType },
        });
      } catch { /* never block job creation on notification failure */ }
    }

    return this.formatJob(job, user);
  }

  async findMyJobs(userId: string, page: number, size: number) {
    const offset = (page - 1) * size;
    const { rows: jobs, count: total } = await this.jobModel.findAndCountAll({
      where: { userId },
      include: [{ model: User, attributes: ['notifSms', 'notifWhatsapp'] }],
      order:  [['createdAt', 'DESC']],
      limit:  size,
      offset,
    });
    return {
      jobs:  jobs.map(j => this.formatJob(j, j.user)),
      total,
      page,
      size,
    };
  }

  async findOne(id: string, user: User) {
    const job = await this.jobModel.findOne({
      where: { id },
      include: [{ model: User, attributes: ['notifSms', 'notifWhatsapp', 'name', 'phone', 'houseNumber'] }],
    });
    if (!job) throw new NotFoundException('Job not found');
    const isBypass = user.role === UserRole.ADMIN || user.role === UserRole.CLERK;
    if (job.userId !== user.id && !isBypass) throw new NotFoundException('Job not found');
    return this.formatJob(job, job.user);
  }

  formatJob(job: Job, user: User | null) {
    const raw = job.toJSON() as any;
    return {
      id:            raw.id,
      userId:        raw.userId,
      fileName:      raw.fileName,
      fileType:      raw.fileName ? raw.fileName.split('.').pop()?.toLowerCase() ?? null : null,
      instructions:  raw.instructions,
      pages:         raw.pages,
      totalPages:    raw.totalPages,
      pageSelection: raw.pageSelection,
      copies:        raw.copies,
      colorMode:     raw.colorMode,
      sides:         raw.sides,
      paperSize:     raw.paperSize,
      deliveryType:  raw.deliveryType,
      paymentMethod: raw.paymentMethod,
      paymentStatus: raw.paymentStatus,
      mpesaRef:      raw.mpesaRef,
      status:        raw.status,
      cost:          Number(raw.cost),
      deliveryFee:   Number(raw.deliveryFee),
      adminNotes:    raw.adminNotes ?? '',
      notifySms:     user?.notifSms      ?? true,
      notifyWhatsapp: user?.notifWhatsapp ?? false,
      createdAt:     raw.createdAt,
      updatedAt:     raw.updatedAt,
    };
  }
}
