import { IsString, IsNotEmpty, IsEnum, MinLength, Matches } from 'class-validator';
import { Transform } from 'class-transformer';
import { UserRole } from '../../users/models/user.model';
import { normalizeKenyanPhone } from '../../../common/utils/phone.util';

export class CreateStaffDto {
  @IsString() @IsNotEmpty()
  name: string;

  @IsString()
  @Transform(({ value }) => normalizeKenyanPhone(value))
  @Matches(/^(\+254|0)[17]\d{8}$/, { message: 'Phone must be a valid Kenyan number' })
  phone: string;

  @IsString() @MinLength(8)
  password: string;

  @IsEnum([UserRole.CLERK, UserRole.ADMIN])
  role: UserRole.CLERK | UserRole.ADMIN;
}
