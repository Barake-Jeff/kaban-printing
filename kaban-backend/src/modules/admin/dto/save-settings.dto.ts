import { IsOptional, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PricingDto } from './pricing.dto';

export class SaveSettingsDto {
  @IsOptional() @IsObject()
  business?: Record<string, any>;

  @IsOptional()
  @ValidateNested()
  @Type(() => PricingDto)
  pricing?: PricingDto;

  @IsOptional() @IsObject()
  notificationMatrix?: Record<string, any>;
}
