import {
  Table, Column, Model, DataType, ForeignKey, BelongsTo, Default, Index,
} from 'sequelize-typescript';
import { User } from '../../users/models/user.model';
import { File } from '../../files/models/file.model';

export enum JobStatus {
  PENDING   = 'pending',
  PRINTING  = 'printing',
  READY     = 'ready',
  DELIVERED = 'delivered',
}

export enum PaymentStatus {
  UNPAID        = 'unpaid',
  PAID          = 'paid',
  PAY_ON_PICKUP = 'pay_on_pickup',
}

export enum ColorMode    { BW = 'bw', COLOR = 'color' }
export enum SideMode     { SINGLE = 'single', DOUBLE = 'double' }
export enum DeliveryType { PICKUP = 'pickup', DELIVERY = 'delivery' }
export enum PaymentMethod { MPESA = 'mpesa', PAY_ON_PICKUP = 'pay_on_pickup' }

@Table({ tableName: 'jobs', timestamps: true, underscored: true })
export class Job extends Model {
  @Column({ type: DataType.UUID, defaultValue: DataType.UUIDV4, primaryKey: true })
  id: string;

  @Index({ name: 'idx_user_id' })
  @ForeignKey(() => User)
  @Column({ type: DataType.UUID, allowNull: false, field: 'user_id' })
  userId: string;

  @BelongsTo(() => User)
  user: User;

  @ForeignKey(() => File)
  @Column({ type: DataType.UUID, allowNull: true, field: 'file_id' })
  fileId: string | null;

  @BelongsTo(() => File)
  file: File;

  @Column({ type: DataType.STRING(500), allowNull: true, field: 'file_name' })
  fileName: string | null;

  @Column({ type: DataType.STRING(1000), allowNull: true, field: 'file_key' })
  fileKey: string | null;

  @Column({ type: DataType.TEXT, allowNull: true })
  instructions: string | null;

  @Default(1)
  @Column({ type: DataType.INTEGER, allowNull: false })
  pages: number;

  @Default(1)
  @Column({ type: DataType.INTEGER, allowNull: false })
  copies: number;

  @Column({ type: DataType.INTEGER, allowNull: true, field: 'total_pages' })
  totalPages: number | null;

  @Column({ type: DataType.STRING(500), allowNull: true, field: 'page_selection' })
  pageSelection: string | null;

  @Default(ColorMode.BW)
  @Column({ type: DataType.ENUM(...Object.values(ColorMode)), allowNull: false, field: 'color_mode' })
  colorMode: ColorMode;

  @Default(SideMode.SINGLE)
  @Column({ type: DataType.ENUM(...Object.values(SideMode)), allowNull: false })
  sides: SideMode;

  @Default('A4')
  @Column({ type: DataType.STRING(20), allowNull: false, field: 'paper_size' })
  paperSize: string;

  @Default(DeliveryType.PICKUP)
  @Column({ type: DataType.ENUM(...Object.values(DeliveryType)), allowNull: false, field: 'delivery_type' })
  deliveryType: DeliveryType;

  @Default(PaymentMethod.MPESA)
  @Column({ type: DataType.ENUM(...Object.values(PaymentMethod)), allowNull: false, field: 'payment_method' })
  paymentMethod: PaymentMethod;

  @Default(PaymentStatus.UNPAID)
  @Column({ type: DataType.ENUM(...Object.values(PaymentStatus)), allowNull: false, field: 'payment_status' })
  paymentStatus: PaymentStatus;

  @Default(JobStatus.PENDING)
  @Column({ type: DataType.ENUM(...Object.values(JobStatus)), allowNull: false })
  status: JobStatus;

  @Default(0)
  @Column({ type: DataType.DECIMAL(10, 2), allowNull: false })
  cost: number;

  @Default(0)
  @Column({ type: DataType.DECIMAL(10, 2), allowNull: false, field: 'delivery_fee' })
  deliveryFee: number;

  @Column({ type: DataType.STRING(50), allowNull: true, field: 'mpesa_ref' })
  mpesaRef: string | null;

  @Column({ type: DataType.TEXT, allowNull: true, field: 'admin_notes' })
  adminNotes: string | null;
}
