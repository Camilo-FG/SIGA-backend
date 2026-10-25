import { IsDateString, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreatePaymentDto {
  @IsString() @MaxLength(36)
  chargeId: string;

  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01)
  amount: number;

  @IsOptional() @IsDateString()
  receivedAt?: string;

  @IsOptional() @IsString() @MaxLength(100)
  reference?: string;

  @IsOptional() @IsString() @MaxLength(500)
  receiptUrl?: string;
}
