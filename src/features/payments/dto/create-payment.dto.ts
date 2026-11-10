import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { PaymentMethod } from '../../../generated/prisma/client.js';

export class CreatePaymentDto {
  @IsString() @MaxLength(36)
  chargeId: string;

  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01)
  amount: number;

  @IsOptional() @IsDateString()
  receivedAt?: string;

  @IsOptional() @IsString() @MaxLength(100)
  reference?: string;

  @IsOptional() @IsString() @MaxLength(500)
  receiptUrl?: string;

  @IsOptional() @IsEnum(PaymentMethod)
  method?: PaymentMethod;
}
