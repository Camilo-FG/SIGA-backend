import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ChargeStatus, Role } from '../../generated/prisma/client.js';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { CreateChargeDto } from './dto/create-charge.dto.js';
import { CreatePaymentDto } from './dto/create-payment.dto.js';
import { ReviewReceiptDto } from './dto/review-receipt.dto.js';
import { PaymentsService } from './payments.service.js';

@Controller('payments')
@Roles(Role.DIRECTOR_GENERAL, Role.DIRECTOR_ADMINISTRATIVO, Role.ASISTENTE_DIRECCION)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}
  @Get('charges') list(@Query('studentId') studentId?: string, @Query('status') status?: ChargeStatus) { return this.paymentsService.list(studentId, status); }
  @Post('charges') createCharge(@Body() dto: CreateChargeDto) { return this.paymentsService.createCharge(dto); }
  @Post() createPayment(@Body() dto: CreatePaymentDto) { return this.paymentsService.createPayment(dto); }
  @Patch(':id/receipt') reviewReceipt(@Param('id') id: string, @Body() dto: ReviewReceiptDto) { return this.paymentsService.reviewReceipt(id, dto); }
}
