import {
  Table, Column, Model, DataType, ForeignKey, Default, Index,
} from 'sequelize-typescript';
import { User } from '../../users/models/user.model';

@Table({ tableName: 'notifications_log', timestamps: false, underscored: true })
export class NotificationLog extends Model {
  @Column({ type: DataType.UUID, defaultValue: DataType.UUIDV4, primaryKey: true })
  id: string;

  @Column({ type: DataType.STRING(36), allowNull: false, field: 'job_id' })
  jobId: string;

  @Index({ name: 'idx_user_id' })
  @ForeignKey(() => User)
  @Column({ type: DataType.UUID, allowNull: false, field: 'user_id' })
  userId: string;

  

  @Column({ type: DataType.ENUM('sms', 'whatsapp', 'push'), allowNull: false })
  channel: 'sms' | 'whatsapp' | 'push';

  @Column({ type: DataType.STRING(100), allowNull: false })
  trigger: string;

  @Column({ type: DataType.STRING(20), allowNull: true })
  phone: string | null;

  @Column({ type: DataType.TEXT, allowNull: false })
  message: string;

  @Default('sent')
  @Column({ type: DataType.ENUM('sent', 'failed'), allowNull: false })
  status: 'sent' | 'failed';

  @Column({ type: DataType.STRING(200), allowNull: true, field: 'provider_id' })
  providerId: string | null;

  @Default(DataType.NOW)
  @Column({ type: DataType.DATE, field: 'sent_at' })
  sentAt: Date;
}
