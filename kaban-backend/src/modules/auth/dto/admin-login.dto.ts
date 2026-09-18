import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class AdminLoginDto {
  @IsString() @IsNotEmpty() phone: string;
  @IsString() @IsNotEmpty() @MaxLength(100) password: string;
}
