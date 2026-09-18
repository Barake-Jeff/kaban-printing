import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class CustomerLoginDto {
  @IsString() @IsNotEmpty() phone: string;
  @IsString() @IsNotEmpty() @MaxLength(100) password: string;
}
