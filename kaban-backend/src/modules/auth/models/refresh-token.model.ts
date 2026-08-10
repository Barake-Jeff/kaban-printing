import {
  Table, Column, Model, DataType, ForeignKey, BelongsTo, Default, Unique, Index,
} from 'sequelize-typescript';
import { User } from '../../users/models/user.model';

@Table({ tableName: 'refresh_tokens', timestamps: false })
export class RefreshToken extends Model {
  @Column({ type: DataType.UUID, defaultValue: DataType.UUIDV4, primaryKey: true })
  id: string;

  @Index({ name: 'idx_user_id' })
  @ForeignKey(() => User)
  @Column({ type: DataType.UUID, allowNull: false, field: 'user_id' })
  userId: string;

  @BelongsTo(() => User)
  user: User;

  @Unique
  @Column({ type: DataType.STRING(255), allowNull: false, field: 'token_hash' })
  tokenHash: string;

  @Column({ type: DataType.DATE, allowNull: false, field: 'expires_at' })
  expiresAt: Date;

  @Default(false)
  @Column({ type: DataType.BOOLEAN })
  revoked: boolean;

  @Column({ type: DataType.DATE, defaultValue: DataType.NOW, field: 'created_at' })
  createdAt: Date;
}
