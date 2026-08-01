import {
  Table, Column, Model, DataType, ForeignKey, BelongsTo, Unique, Index,
} from 'sequelize-typescript';
import { User } from '../../users/models/user.model';

@Table({ tableName: 'push_subscriptions', timestamps: false, underscored: true })
export class PushSubscription extends Model {
  @Column({ type: DataType.UUID, defaultValue: DataType.UUIDV4, primaryKey: true })
  id: string;

  @Index({ name: 'idx_user_id' })
  @ForeignKey(() => User)
  @Column({ type: DataType.UUID, allowNull: false, field: 'user_id' })
  userId: string;

  @BelongsTo(() => User)
  user: User;

  @Column({ type: DataType.TEXT, allowNull: false })
  endpoint: string;

  @Column({ type: DataType.TEXT, allowNull: false })
  p256dh: string;

  @Column({ type: DataType.TEXT, allowNull: false })
  auth: string;

  @Column({ type: DataType.DATE, defaultValue: DataType.NOW, field: 'created_at' })
  createdAt: Date;
}
