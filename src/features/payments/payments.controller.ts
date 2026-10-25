import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ChargeStatus, Role } from '../../generated/prisma/client.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CreateChargeDto } from './dto/create-charge.dto.js';
import { CreatePaymentDto } from './dto/create-payment.dto.js';
import { ReviewReceiptDto } from './dto/review-receipt.dto.js';
import { PaymentsService } from './payments.service.js';

const financeReaders = [Role.DIRECTOR_GENERAL, Role.DIRECTOR_ADMINISTRATIVO, Role.ASISTENTE_DIRECCION] as const;
const financeManagers = [Role.DIRECTOR_GENERAL, Role.DIRECTOR_ADMINISTRATIVO] as const;

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}
  @Get('charges')
  @Roles(...financeReaders)
  list(@Query('studentId') studentId?: string, @Query('status') status?: ChargeStatus) { return this.paymentsService.list(studentId, status); }
  @Post('charges')
  @Roles(...financeManagers)
  createCharge(@Body() dto: CreateChargeDto) { return this.paymentsService.createCharge(dto); }
  @Post()
  @Roles(...financeManagers)
  createPayment(@Body() dto: CreatePaymentDto) { return this.paymentsService.createPayment(dto); }
  @Patch(':id/receipt')
  @Roles(...financeManagers)
  reviewReceipt(@Param('id') id: string, @Body() dto: ReviewReceiptDto) { return this.paymentsService.reviewReceipt(id, dto); }
}
