import {
  Table, Column, Model, DataType, ForeignKey, BelongsTo, Default,
} from 'sequelize-typescript';
import { User } from '../../users/models/user.model';

export enum PasswordResetRequestStatus {
  PENDING  = 'pending',
  RESOLVED = 'resolved',
}

@Table({
  tableName: 'password_reset_requests', timestamps: false,
  indexes: [
    { name: 'idx_user_id', fields: ['user_id'] },
    { name: 'idx_status', fields: ['status'] },
  ],
})
export class PasswordResetRequest extends Model {
  @Column({ type: DataType.UUID, defaultValue: DataType.UUIDV4, primaryKey: true })
  id: string;

  @ForeignKey(() => User)
  @Column({ type: DataType.UUID, allowNull: false, field: 'user_id' })
  userId: string;

  @BelongsTo(() => User, 'userId')
  user: User;

  @Default(PasswordResetRequestStatus.PENDING)
  @Column({ type: DataType.ENUM(...Object.values(PasswordResetRequestStatus)) })
  status: PasswordResetRequestStatus;

  @Column({ type: DataType.DATE, defaultValue: DataType.NOW, field: 'created_at' })
  createdAt: Date;

  @Column({ type: DataType.DATE, allowNull: true, field: 'resolved_at' })
  resolvedAt: Date | null;

  @ForeignKey(() => User)
  @Column({ type: DataType.UUID, allowNull: true, field: 'resolved_by_user_id' })
  resolvedByUserId: string | null;

  @BelongsTo(() => User, 'resolvedByUserId')
  resolvedBy: User | null;
}
