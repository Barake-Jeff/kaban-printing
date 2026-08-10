import { IsBoolean } from 'class-validator';

export class UpdateNotifPrefsDto {
  @IsBoolean()
  notifSms: boolean;

  @IsBoolean()
  notifWhatsapp: boolean;
}
