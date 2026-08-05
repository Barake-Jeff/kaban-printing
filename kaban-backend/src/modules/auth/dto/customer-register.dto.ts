import { IsString, IsNotEmpty, MinLength, MaxLength, Matches } from 'class-validator';
import { Transform } from 'class-transformer';
import { normalizeKenyanPhone } from '../../../common/utils/phone.util';

export class CustomerRegisterDto {
  @IsString() @IsNotEmpty() @MaxLength(255)
  name: string;

  // @Transform runs during plainToInstance, i.e. BEFORE @Matches — so a number
  // typed as "0712 345 678" or "+254712345678" is folded to "0712345678" first.
  @IsString()
  @Transform(({ value }) => normalizeKenyanPhone(value))
  @Matches(/^(\+254|0)[17]\d{8}$/, { message: 'Phone must be a valid Kenyan number (e.g. 0712345678)' })
  phone: string;

  @IsString() @IsNotEmpty() @MaxLength(20)
  houseNumber: string;

  @IsString() @IsNotEmpty() @MaxLength(255)
  estate: string;

  @IsString() @MinLength(8) @MaxLength(100)
  password: string;
}
