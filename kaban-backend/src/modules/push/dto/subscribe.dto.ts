import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class SubscribeDto {
  @IsString() @IsNotEmpty() @MaxLength(2048)
  endpoint: string;

  @IsString() @IsNotEmpty() @MaxLength(255)
  p256dh: string;

  @IsString() @IsNotEmpty() @MaxLength(255)
  auth: string;
}
