import { IsUUID, IsString, Matches } from 'class-validator';

export class InitiateMpesaDto {
  @IsUUID()
  jobId: string;

  @IsString()
  @Matches(/^(\+254|0)[17]\d{8}$/, { message: 'Phone must be a valid Kenyan number' })
  phone: string;
}
