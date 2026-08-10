import { IsOptional, IsObject } from 'class-validator';

export class SaveSettingsDto {
  @IsOptional() @IsObject()
  business?: Record<string, any>;

  @IsOptional() @IsObject()
  pricing?: Record<string, any>;

  @IsOptional() @IsObject()
  notificationMatrix?: Record<string, any>;
}
