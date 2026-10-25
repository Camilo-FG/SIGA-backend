import { IsEnum } from 'class-validator';
import { ReceiptStatus } from '../../../generated/prisma/client.js';

export class ReviewReceiptDto {
  @IsEnum(ReceiptStatus)
  status: ReceiptStatus;
}
