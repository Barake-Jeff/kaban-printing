import {
  IsString, IsOptional, IsEnum, IsInt, IsPositive, Min, IsUUID, MaxLength,
} from 'class-validator';
import { ColorMode, SideMode, DeliveryType, PaymentMethod } from '../models/job.model';

export class CreateJobDto {
  @IsOptional()
  @IsUUID()
  fileId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  fileName?: string;

  @IsOptional()
  @IsString()
  instructions?: string;

  @IsInt()
  @IsPositive()
  pages: number;

  @IsInt()
  @Min(1)
  copies: number;

  @IsEnum(ColorMode)
  colorMode: ColorMode;

  @IsEnum(SideMode)
  sides: SideMode;

  @IsString()
  @MaxLength(20)
  paperSize: string;

  @IsEnum(DeliveryType)
  deliveryType: DeliveryType;

  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;
}
