import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, fn, col, literal, QueryTypes } from 'sequelize';
import * as bcrypt from 'bcrypt';
import { Job, JobStatus, PaymentStatus } from '../jobs/models/job.model';
import { User, UserRole } from '../users/models/user.model';
import { Payment, PaymentRecordStatus, PaymentRecordMethod } from '../payments/models/payment.model';
import { Setting } from './models/setting.model';
import { FilesService } from '../files/files.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UpdateJobStatusDto } from './dto/update-job-status.dto';
import { SaveNotesDto } from './dto/save-notes.dto';
import { CreateStaffDto } from './dto/create-staff.dto';
import { SaveSettingsDto } from './dto/save-settings.dto';
import { DEFAULT_PRICING } from '../../common/utils/pricing.util';

const DEFAULT_SETTINGS = {
  business: {
    name: 'PrintEase',
    phone: '0700000000',
    address: 'Westlands, Nairobi',
    hours: {
      mon: { open: true,  from: '07:00', to: '20:00' },
      tue: { open: true,  from: '07:00', to: '20:00' },
      wed: { open: true,  from: '07:00', to: '20:00' },
      thu: { open: true,  from: '07:00', to: '20:00' },
      fri: { open: true,  from: '07:00', to: '20:00' },
      sat: { open: true,  from: '08:00', to: '18:00' },
      sun: { open: false, from: '09:00', to: '14:00' },
    },
  },
  pricing: DEFAULT_PRICING,
  notificationMatrix: {
    job_received:      { sms: true,  whatsapp: true,  push: true  },
    payment_confirmed: { sms: true,  whatsapp: true,  push: true  },
    printing_started:  { sms: false, whatsapp: true,  push: true  },
    job_ready:         { sms: true,  whatsapp: true,  push: true  },
    job_delivered:     { sms: true,  whatsapp: false, push: true  },
    payment_failed:    { sms: true,  whatsapp: false, push: false },
  },
};

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(Job)      private readonly jobModel:     typeof Job,
    @InjectModel(User)     private readonly userModel:    typeof User,
    @InjectModel(Payment)  private readonly paymentModel: typeof Payment,
    @InjectModel(Setting)  private readonly settingModel: typeof Setting,
    private readonly filesService: FilesService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // ── Queue & Stats ──────────────────────────────────────────────────────────

  async getQueue(status?: string, page = 1, size = 50) {
    const where: any = {};
    if (status) where.status = status;

    const { rows: jobs, count: total } = await this.jobModel.findAndCountAll({
      where,
      include: [{ model: User, attributes: ['name', 'phone', 'houseNumber', 'notifSms', 'notifWhatsapp'] }],
      order:   [['createdAt', 'DESC']],
      limit:   size,
      offset:  (page - 1) * size,
    });

    return { jobs: jobs.map(j => this.formatAdminJob(j)), total, page, size };
  }

  async getStats() {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd   = new Date(); todayEnd.setHours(23, 59, 59, 999);

    const [jobsToday, pending, printing, ready, delivered, revenueRows] = await Promise.all([
      this.jobModel.count({ where: { createdAt: { [Op.between]: [todayStart, todayEnd] } } }),
      this.jobModel.count({ where: { status: JobStatus.PENDING } }),
      this.jobModel.count({ where: { status: JobStatus.PRINTING } }),
      this.jobModel.count({ where: { status: JobStatus.READY } }),
      this.jobModel.count({ where: { status: JobStatus.DELIVERED } }),
      this.jobModel.findAll({
        where: { paymentStatus: PaymentStatus.PAID, createdAt: { [Op.between]: [todayStart, todayEnd] } },
        attributes: [[fn('SUM', literal('cost + delivery_fee')), 'total']],
        raw: true,
      }),
    ]);

    return {
      jobsToday,
      pending,
      printing,
      ready,
      completed:    delivered,
      revenueToday: Number((revenueRows[0] as any)?.total ?? 0),
    };
  }

  // ── Job mutations ──────────────────────────────────────────────────────────

  async updateStatus(id: string, dto: UpdateJobStatusDto) {
    const job = await this.jobModel.findOne({ where: { id }, include: [{ model: User }] });
    if (!job) throw new NotFoundException('Job not found');

    const updates: Partial<Job> = { status: dto.status };
    if (dto.status === JobStatus.READY) {
      // (Re)entering ready — restart the 30-min overdue clock and allow a fresh push.
      updates.readyAt = new Date();
      updates.readyOverdueNotifiedAt = null;
    } else if (dto.status === JobStatus.PENDING || dto.status === JobStatus.PRINTING) {
      // Reverted out of the ready/delivered lifecycle — clear stale bookkeeping.
      updates.readyAt = null;
      updates.readyOverdueNotifiedAt = null;
    } else if (dto.status === JobStatus.DELIVERED && !job.readyAt) {
      // Skipped straight past ready (e.g. printing -> delivered) — stamp it
      // anyway so readyAt is never left null for a job that's actually done.
      updates.readyAt = new Date();
    }
    await job.update(updates);

    const triggerMap: Partial<Record<JobStatus, string>> = {
      [JobStatus.PRINTING]:  'printing_started',
      [JobStatus.READY]:     'job_ready',
      [JobStatus.DELIVERED]: 'job_delivered',
    };
    const trigger = triggerMap[dto.status];
    if (trigger && job.user) {
      try {
        await this.notificationsService.send(trigger as any, {
          jobId: job.id, userId: job.userId,
          user: {
            name: job.user.name, phone: job.user.phone, houseNumber: job.user.houseNumber,
            notifSms: job.user.notifSms, notifWhatsapp: job.user.notifWhatsapp,
          },
          job: {
            fileName: job.fileName, pages: job.pages, copies: job.copies,
            cost: Number(job.cost), deliveryFee: Number(job.deliveryFee),
            deliveryType: job.deliveryType,
          },
        });
      } catch { /* never block status update on notification failure */ }
    }

    return this.formatAdminJob(job);
  }

  async markAsPaid(id: string) {
    const job = await this.jobModel.findOne({ where: { id } });
    if (!job) throw new NotFoundException('Job not found');
    await job.update({ paymentStatus: PaymentStatus.PAID });

    const existing = await this.paymentModel.findOne({ where: { jobId: id } });
    if (existing) {
      await existing.update({ status: PaymentRecordStatus.COMPLETED, paidAt: new Date() });
    } else {
      await this.paymentModel.create({
        jobId:  id,
        userId: job.userId,
        method: PaymentRecordMethod.CASH,
        amount: Number(job.cost) + Number(job.deliveryFee),
        status: PaymentRecordStatus.COMPLETED,
        paidAt: new Date(),
      });
    }

    return { success: true };
  }

  async saveNotes(id: string, dto: SaveNotesDto) {
    const job = await this.jobModel.findOne({ where: { id } });
    if (!job) throw new NotFoundException('Job not found');
    await job.update({ adminNotes: dto.notes });
    return { success: true };
  }

  async cancelJob(id: string) {
    const job = await this.jobModel.findOne({ where: { id } });
    if (!job) throw new NotFoundException('Job not found');
    await job.destroy();
    return { success: true };
  }

  async getFileUrl(jobId: string) {
    const job = await this.jobModel.findOne({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Job not found');
    if (!job.fileId) throw new NotFoundException('No file attached to this job');
    const url = await this.filesService.getPresignedUrlForAdmin(job.fileId);
    return { url, fileName: job.fileName ?? 'document' };
  }

  // ── Customers ──────────────────────────────────────────────────────────────

  async getCustomers() {
    const users = await this.userModel.findAll({
      where: { role: 'customer' },
      order: [['createdAt', 'DESC']],
    });
    if (!users.length) return [];

    const jobs = await this.jobModel.findAll({
      where: { userId: { [Op.in]: users.map(u => u.id) } },
      attributes: ['userId', 'paymentMethod', 'cost', 'deliveryFee', 'paymentStatus'],
      raw: true,
    }) as any[];

    return users.map(u => this.aggregateCustomer(u, jobs.filter(j => j.userId === u.id)));
  }

  async lookupCustomer(house: string) {
    const user = await this.userModel.findOne({ where: { houseNumber: house } });
    if (!user) throw new NotFoundException(`No customer at house ${house}`);

    const jobs = await this.jobModel.findAll({
      where: { userId: user.id },
      attributes: ['userId', 'paymentMethod', 'cost', 'deliveryFee', 'paymentStatus'],
      raw: true,
    }) as any[];

    return this.aggregateCustomer(user, jobs);
  }

  // ── Staff ──────────────────────────────────────────────────────────────────

  async getStaff() {
    const members = await this.userModel.findAll({
      where: { role: { [Op.in]: [UserRole.CLERK, UserRole.ADMIN] } },
      order: [['createdAt', 'ASC']],
    });
    return members.map(m => this.formatStaff(m));
  }

  async createStaffMember(dto: CreateStaffDto) {
    const phone = this.normalizePhone(dto.phone);
    const existing = await this.userModel.findOne({ where: { phone } });
    if (existing) throw new ConflictException('Phone number already registered');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const member = await this.userModel.create({
      name: dto.name,
      phone,
      houseNumber: 'N/A',
      estate: 'N/A',
      passwordHash,
      role: dto.role,
      active: true,
    });

    return this.formatStaff(member);
  }

  async deactivateStaff(id: string) {
    const member = await this.userModel.findOne({
      where: { id, role: { [Op.in]: [UserRole.CLERK, UserRole.ADMIN] } },
    });
    if (!member) throw new NotFoundException('Staff member not found');
    await member.update({ active: false });
    return { success: true };
  }

  async reactivateStaff(id: string) {
    const member = await this.userModel.findOne({
      where: { id, role: { [Op.in]: [UserRole.CLERK, UserRole.ADMIN] } },
    });
    if (!member) throw new NotFoundException('Staff member not found');
    await member.update({ active: true });
    return { success: true };
  }

  // ── Settings ───────────────────────────────────────────────────────────────

  async getSettings() {
    const rows = await this.settingModel.findAll({ raw: true });
    const map: Record<string, any> = {};
    for (const row of rows) {
      try { map[row.key] = JSON.parse(row.value); } catch { map[row.key] = row.value; }
    }
    return {
      business:           map.business           ?? DEFAULT_SETTINGS.business,
      pricing:            map.pricing            ?? DEFAULT_SETTINGS.pricing,
      notificationMatrix: map.notificationMatrix ?? DEFAULT_SETTINGS.notificationMatrix,
    };
  }

  async saveSettings(dto: SaveSettingsDto) {
    const updates: Array<{ key: string; value: string }> = [];
    if (dto.business)           updates.push({ key: 'business',           value: JSON.stringify(dto.business) });
    if (dto.pricing)            updates.push({ key: 'pricing',            value: JSON.stringify(dto.pricing) });
    if (dto.notificationMatrix) updates.push({ key: 'notificationMatrix', value: JSON.stringify(dto.notificationMatrix) });

    await Promise.all(
      updates.map(u => this.settingModel.upsert({ key: u.key, value: u.value }))
    );

    return { success: true };
  }

  // ── Reports ────────────────────────────────────────────────────────────────

  async getReports() {
    const sequelize = (this.jobModel as any).sequelize;

    const cutoff14 = new Date();
    cutoff14.setDate(cutoff14.getDate() - 13);
    cutoff14.setHours(0, 0, 0, 0);

    const [
      dailyRevenue,
      jobsByDayOfWeek,
      jobsByStatus,
      fulfillmentRows,
      paymentMethodSplit,
      topCustomers,
    ] = await Promise.all([
      // Revenue per day for past 14 days (paid jobs only)
      sequelize.query(
        `SELECT DATE(created_at) AS date, SUM(cost + delivery_fee) AS revenue
         FROM jobs
         WHERE payment_status = 'paid' AND created_at >= :cutoff
         GROUP BY DATE(created_at)
         ORDER BY DATE(created_at) ASC`,
        { replacements: { cutoff: cutoff14 }, type: QueryTypes.SELECT },
      ) as Promise<{ date: string; revenue: string }[]>,

      // Jobs by day of week (0=Sun … 6=Sat, MySQL DAYOFWEEK is 1=Sun)
      sequelize.query(
        `SELECT DAYOFWEEK(created_at) AS dow, COUNT(*) AS count
         FROM jobs GROUP BY DAYOFWEEK(created_at)`,
        { type: QueryTypes.SELECT },
      ) as Promise<{ dow: number; count: string }[]>,

      // Jobs by status
      sequelize.query(
        `SELECT status, COUNT(*) AS count FROM jobs GROUP BY status`,
        { type: QueryTypes.SELECT },
      ) as Promise<{ status: string; count: string }[]>,

      // Average fulfillment (created_at → updated_at for delivered jobs)
      sequelize.query(
        `SELECT AVG(TIMESTAMPDIFF(MINUTE, created_at, updated_at)) AS avg_minutes
         FROM jobs WHERE status = 'delivered'`,
        { type: QueryTypes.SELECT },
      ) as Promise<{ avg_minutes: string | null }[]>,

      // Payment method split
      sequelize.query(
        `SELECT payment_method AS method, COUNT(*) AS count FROM jobs GROUP BY payment_method`,
        { type: QueryTypes.SELECT },
      ) as Promise<{ method: string; count: string }[]>,

      // Top 5 customers by total spent
      sequelize.query(
        `SELECT u.name, SUM(j.cost + j.delivery_fee) AS totalSpent, COUNT(j.id) AS totalJobs
         FROM jobs j
         JOIN users u ON j.user_id = u.id
         WHERE j.payment_status = 'paid'
         GROUP BY j.user_id, u.name
         ORDER BY totalSpent DESC
         LIMIT 5`,
        { type: QueryTypes.SELECT },
      ) as Promise<{ name: string; totalSpent: string; totalJobs: string }[]>,
    ]);

    const DAY_NAMES = ['', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return {
      dailyRevenue: dailyRevenue.map(r => ({
        date:    String(r.date).substring(0, 10),
        revenue: Number(r.revenue),
      })),
      jobsByDayOfWeek: jobsByDayOfWeek.map(r => ({
        day:   DAY_NAMES[r.dow] ?? String(r.dow),
        count: Number(r.count),
      })),
      jobsByStatus: jobsByStatus.map(r => ({
        status: r.status,
        count:  Number(r.count),
      })),
      averageFulfillmentMinutes: Math.round(Number(fulfillmentRows[0]?.avg_minutes ?? 0)),
      paymentMethodSplit: paymentMethodSplit.map(r => ({
        method: r.method,
        count:  Number(r.count),
      })),
      topCustomers: topCustomers.map(r => ({
        name:       r.name,
        totalSpent: Number(r.totalSpent),
        totalJobs:  Number(r.totalJobs),
      })),
    };
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private formatStaff(user: User) {
    return {
      id:       user.id,
      name:     user.name,
      phone:    user.phone,
      role:     user.role as 'clerk' | 'admin',
      active:   user.active,
      joinedAt: (user as any).createdAt?.toISOString?.() ?? new Date().toISOString(),
    };
  }

  private aggregateCustomer(user: User, jobs: any[]) {
    const paidJobs = jobs.filter(j => j.paymentStatus === 'paid');
    return {
      id:               user.id,
      name:             user.name,
      houseNumber:      user.houseNumber,
      phone:            user.phone,
      totalJobs:        jobs.length,
      totalSpent:       paidJobs.reduce((sum, j) => sum + Number(j.cost) + Number(j.deliveryFee), 0),
      payOnPickupCount: jobs.filter(j => j.paymentMethod === 'pay_on_pickup').length,
      mpesaCount:       jobs.filter(j => j.paymentMethod === 'mpesa').length,
    };
  }

  private formatAdminJob(job: Job) {
    const raw = job.toJSON() as any;
    return {
      id:             raw.id,
      userId:         raw.userId,
      fileName:       raw.fileName,
      fileType:       raw.fileName ? raw.fileName.split('.').pop()?.toLowerCase() ?? null : null,
      instructions:   raw.instructions,
      pages:          raw.pages,
      totalPages:     raw.totalPages,
      pageSelection:  raw.pageSelection,
      copies:         raw.copies,
      colorMode:      raw.colorMode,
      sides:          raw.sides,
      paperSize:      raw.paperSize,
      deliveryType:   raw.deliveryType,
      paymentMethod:  raw.paymentMethod,
      paymentStatus:  raw.paymentStatus,
      mpesaRef:       raw.mpesaRef,
      status:         raw.status,
      readyAt:        raw.readyAt,
      cost:           Number(raw.cost),
      deliveryFee:    Number(raw.deliveryFee),
      adminNotes:     raw.adminNotes ?? '',
      notifySms:      raw.user?.notifSms      ?? true,
      notifyWhatsapp: raw.user?.notifWhatsapp  ?? false,
      createdAt:      raw.createdAt,
      updatedAt:      raw.updatedAt,
      customerName:   raw.user?.name        ?? null,
      houseNumber:    raw.user?.houseNumber  ?? null,
      phone:          raw.user?.phone        ?? null,
    };
  }

  private normalizePhone(phone: string): string {
    return phone.replace(/^\+254/, '0').replace(/\s/g, '');
  }
}
