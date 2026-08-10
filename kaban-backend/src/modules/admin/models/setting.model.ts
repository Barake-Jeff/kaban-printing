import { Table, Column, Model, DataType } from 'sequelize-typescript';

@Table({ tableName: 'settings', timestamps: false })
export class Setting extends Model {
  @Column({ type: DataType.STRING(50), primaryKey: true })
  key: string;

  @Column({ type: DataType.TEXT('long'), allowNull: false })
  value: string;
}
