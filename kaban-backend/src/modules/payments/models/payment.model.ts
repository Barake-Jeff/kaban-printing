import {
  Table, Column, Model, DataType, ForeignKey, BelongsTo, Default, Unique, Index,
} from 'sequelize-typescript';
import { User } from '../../users/models/user.model';
import { Job } from '../../jobs/models/job.model';

export enum PaymentRecordStatus {
  PENDING   = 'pending',
  COMPLETED = 'completed',
  FAILED    = 'failed',
  CANCELLED = 'cancelled',
}

export enum PaymentRecordMethod {
  MPESA         = 'mpesa',
  CASH          = 'cash',
  PAY_ON_PICKUP = 'pay_on_pickup',
}

@Table({ tableName: 'payments', timestamps: true, underscored: true })
export class Payment extends Model {
  @Column({ type: DataType.UUID, defaultValue: DataType.UUIDV4, primaryKey: true })
  id: string;

  @Unique
  @ForeignKey(() => Job)
  @Column({ type: DataType.UUID, allowNull: false, field: 'job_id' })
  jobId: string;

  @BelongsTo(() => Job)
  job: Job;

  @Index({ name: 'idx_user_id' })
  @ForeignKey(() => User)
  @Column({ type: DataType.UUID, allowNull: false, field: 'user_id' })
  userId: string;

  @BelongsTo(() => User)
  user: User;

  @Column({ type: DataType.ENUM(...Object.values(PaymentRecordMethod)), allowNull: false })
  method: PaymentRecordMethod;

  @Column({ type: DataType.DECIMAL(10, 2), allowNull: false })
  amount: number;

  @Default(PaymentRecordStatus.PENDING)
  @Column({ type: DataType.ENUM(...Object.values(PaymentRecordStatus)), allowNull: false })
  status: PaymentRecordStatus;

  @Column({ type: DataType.STRING(50), allowNull: true, field: 'mpesa_ref' })
  mpesaRef: string | null;

  @Column({ type: DataType.STRING(100), allowNull: true, field: 'mpesa_receipt' })
  mpesaReceipt: string | null;

  @Column({ type: DataType.STRING(20), allowNull: true })
  phone: string | null;

  @Column({ type: DataType.STRING(100), allowNull: true, field: 'merchant_req_id' })
  merchantReqId: string | null;

  @Column({ type: DataType.STRING(100), allowNull: true, field: 'checkout_req_id' })
  checkoutReqId: string | null;

  @Column({ type: DataType.STRING(10), allowNull: true, field: 'result_code' })
  resultCode: string | null;

  @Column({ type: DataType.STRING(500), allowNull: true, field: 'result_desc' })
  resultDesc: string | null;

  @Column({ type: DataType.DATE, allowNull: true, field: 'paid_at' })
  paidAt: Date | null;
}
