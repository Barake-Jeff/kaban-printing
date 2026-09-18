import { IsString, Matches } from 'class-validator';
import { Transform } from 'class-transformer';
import { normalizeKenyanPhone } from '../../../common/utils/phone.util';

export class ForgotPasswordDto {
  @IsString()
  @Transform(({ value }) => normalizeKenyanPhone(value))
  @Matches(/^(\+254|0)[17]\d{8}$/, { message: 'Phone must be a valid Kenyan number' })
  phone: string;
}
