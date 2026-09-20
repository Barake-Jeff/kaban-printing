import { IsNumber, Min } from 'class-validator';

export class PricingDto {
  @IsNumber() @Min(0)
  bwPerPage: number;

  @IsNumber() @Min(0)
  colorPerPage: number;

  @IsNumber() @Min(0)
  doubleSidedMultiplier: number;

  @IsNumber() @Min(0)
  deliveryFee: number;
}
