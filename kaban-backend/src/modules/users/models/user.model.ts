import {
  Table, Column, Model, DataType, Default, Unique,
} from 'sequelize-typescript';

export enum UserRole {
  CUSTOMER = 'customer',
  CLERK    = 'clerk',
  ADMIN    = 'admin',
}

@Table({ tableName: 'users', timestamps: true, underscored: true })
export class User extends Model {
  @Column({ type: DataType.UUID, defaultValue: DataType.UUIDV4, primaryKey: true })
  id: string;

  @Column({ type: DataType.STRING(255), allowNull: false })
  name: string;

  @Unique
  @Column({ type: DataType.STRING(20), allowNull: false })
  phone: string;

  @Column({ type: DataType.STRING(20), allowNull: false, field: 'house_number' })
  houseNumber: string;

  @Column({ type: DataType.STRING(255), allowNull: false })
  estate: string;

  @Column({ type: DataType.STRING(255), allowNull: false, field: 'password_hash' })
  passwordHash: string;

  @Default(UserRole.CUSTOMER)
  @Column({ type: DataType.ENUM(...Object.values(UserRole)) })
  role: UserRole;

  @Default(true)
  @Column({ type: DataType.BOOLEAN, field: 'notif_sms' })
  notifSms: boolean;

  @Default(false)
  @Column({ type: DataType.BOOLEAN, field: 'notif_whatsapp' })
  notifWhatsapp: boolean;

  @Default(0.00)
  @Column({ type: DataType.DECIMAL(10, 2), field: 'credit_balance' })
  creditBalance: number;

  @Default(0)
  @Column({ type: DataType.INTEGER, field: 'loyalty_points' })
  loyaltyPoints: number;

  @Default(true)
  @Column({ type: DataType.BOOLEAN, allowNull: false })
  active: boolean;

}
