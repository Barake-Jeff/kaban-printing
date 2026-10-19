import { IsString, IsNotEmpty, MaxLength, ValidateBy } from 'class-validator';
import { isAllowedPushEndpoint } from '../push-endpoint.util';

export class SubscribeDto {
  @IsString() @IsNotEmpty() @MaxLength(2048)
  @ValidateBy({
    name: 'isAllowedPushEndpoint',
    validator: { validate: isAllowedPushEndpoint, defaultMessage: () => 'Unsupported push service' },
  })
  endpoint: string;

  @IsString() @IsNotEmpty() @MaxLength(255)
  p256dh: string;

  @IsString() @IsNotEmpty() @MaxLength(255)
  auth: string;
}
