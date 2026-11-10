import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ReceiptStatus } from '../../../generated/prisma/client.js';

export class ReviewReceiptDto {
  @IsEnum(ReceiptStatus)
  status: ReceiptStatus;

  @IsOptional() @IsString() @MaxLength(300)
  reason?: string;
}
