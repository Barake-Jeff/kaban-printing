import { IsString, MinLength, MaxLength, Matches } from 'class-validator';

export class SetUserPasswordDto {
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  @Matches(/(?=.*[A-Za-z])(?=.*\d)/, { message: 'Password must contain at least one letter and one number' })
  newPassword: string;
}
