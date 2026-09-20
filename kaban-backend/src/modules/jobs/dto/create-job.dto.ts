import {
  IsString, IsOptional, IsEnum, IsInt, IsPositive, Min, Max, IsUUID, MaxLength,
} from 'class-validator';
import { ColorMode, SideMode, DeliveryType, PaymentMethod } from '../models/job.model';
import { MAX_COPIES, MAX_INSTRUCTIONS_LENGTH } from '../../../common/constants/limits';

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
  @MaxLength(MAX_INSTRUCTIONS_LENGTH)
  instructions?: string;

  @IsInt()
  @IsPositive()
  pages: number;

  @IsInt()
  @Min(1)
  @Max(MAX_COPIES)
  copies: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  pageSelection?: string;

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
