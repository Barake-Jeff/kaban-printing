import {
  Table, Column, Model, DataType, ForeignKey, BelongsTo, Index,
} from 'sequelize-typescript';
import { User } from '../../users/models/user.model';

@Table({ tableName: 'files', timestamps: false, underscored: true })
export class File extends Model {
  @Column({ type: DataType.UUID, defaultValue: DataType.UUIDV4, primaryKey: true })
  id: string;

  @Index({ name: 'idx_user_id' })
  @ForeignKey(() => User)
  @Column({ type: DataType.UUID, allowNull: false, field: 'user_id' })
  userId: string;

  @BelongsTo(() => User)
  user: User;

  @Column({ type: DataType.STRING(500), allowNull: false, field: 'original_name' })
  originalName: string;

  @Column({ type: DataType.STRING(500), allowNull: false, field: 'stored_name' })
  storedName: string;

  @Column({ type: DataType.STRING(100), allowNull: false, field: 'mime_type' })
  mimeType: string;

  @Column({ type: DataType.INTEGER, allowNull: false, field: 'size_bytes' })
  sizeBytes: number;

  @Column({ type: DataType.INTEGER, defaultValue: 1, field: 'page_count' })
  pageCount: number;

  @Column({ type: DataType.STRING(1000), allowNull: false, field: 'file_key' })
  fileKey: string;

  @Column({ type: DataType.STRING(1000), allowNull: true, field: 'pdf_key' })
  pdfKey: string | null;

  @Column({ type: DataType.DATE, defaultValue: DataType.NOW, field: 'created_at' })
  createdAt: Date;
}
