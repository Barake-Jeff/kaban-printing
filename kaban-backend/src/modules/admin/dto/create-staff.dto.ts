import { IsString, IsNotEmpty, IsEnum, MinLength, MaxLength, Matches } from 'class-validator';
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

  @IsString() @MinLength(12) @MaxLength(100)
  @Matches(/(?=.*[A-Za-z])(?=.*\d)/, { message: 'Password must contain at least one letter and one number' })
  password: string;

  @IsEnum([UserRole.CLERK, UserRole.ADMIN])
  role: UserRole.CLERK | UserRole.ADMIN;
}
