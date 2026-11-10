import { Body, Controller, Get, Param, Patch, Post, Query, StreamableFile, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ChargeStatus, PaymentPeriodicity, Role } from '../../generated/prisma/client.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import type { UploadedFile as StoredUpload } from '../../files/files.service.js';
import type { PublicUser } from '../../users/users.service.js';
import { CreateChargeDto } from './dto/create-charge.dto.js';
import { CreatePaymentDto } from './dto/create-payment.dto.js';
import { ReviewReceiptDto } from './dto/review-receipt.dto.js';
import { PaymentsService } from './payments.service.js';

const financeReaders = [Role.DIRECTOR_GENERAL, Role.DIRECTOR_ADMINISTRATIVO, Role.ASISTENTE_DIRECCION] as const;
const financeWriters = [Role.DIRECTOR_ADMINISTRATIVO, Role.ASISTENTE_DIRECCION] as const;

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('concepts')
  @Roles(...financeReaders)
  concepts() { return this.paymentsService.listConcepts(); }

  @Post('concepts')
  @Roles(Role.DIRECTOR_ADMINISTRATIVO)
  createConcept(@Body() body: { name: string; amount: number; periodicity: PaymentPeriodicity }) { return this.paymentsService.createConcept(body); }

  @Patch('concepts/:id')
  @Roles(Role.DIRECTOR_ADMINISTRATIVO)
  updateConcept(@Param('id') id: string, @Body() body: { name?: string; amount?: number; active?: boolean }) { return this.paymentsService.updateConcept(id, body); }

  @Get('charges')
  @Roles(...financeReaders)
  list(@Query('studentId') studentId?: string, @Query('status') status?: ChargeStatus, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.paymentsService.list(studentId, status, page ? Number(page) : 1, limit ? Number(limit) : 50);
  }

  @Post('charges')
  @Roles(...financeWriters)
  createCharge(@Body() dto: CreateChargeDto) { return this.paymentsService.createCharge(dto); }

  @Post('charges/generate')
  @Roles(...financeWriters)
  generate(@Body() body: { period: string; conceptId: string; dueDate: string }) { return this.paymentsService.generateMonthly(body); }

  @Patch('charges/:id/annul')
  @Roles(Role.DIRECTOR_ADMINISTRATIVO)
  annul(@Param('id') id: string, @Body() body: { reason: string }, @CurrentUser() user: PublicUser) { return this.paymentsService.annulCharge(id, body.reason, user); }

  @Get('delinquency')
  @Roles(...financeReaders)
  delinquency(@Query('period') period?: string) { return this.paymentsService.delinquency(period); }

  @Get('students/:studentId/statement')
  @Roles(...financeReaders)
  statement(@Param('studentId') studentId: string) { return this.paymentsService.statement(studentId); }

  @Post()
  @Roles(...financeWriters)
  @UseInterceptors(FileInterceptor('receipt', { limits: { fileSize: 5 * 1024 * 1024 } }))
  createPayment(@Body() dto: CreatePaymentDto, @CurrentUser() user: PublicUser, @UploadedFile() file?: StoredUpload) {
    return this.paymentsService.createPayment(dto, user, file);
  }

  @Get(':id/receipt')
  @Roles(...financeReaders)
  async receipt(@Param('id') id: string) { return new StreamableFile(await this.paymentsService.openReceipt(id)); }

  @Patch(':id/receipt')
  @Roles(...financeWriters)
  reviewReceipt(@Param('id') id: string, @Body() dto: ReviewReceiptDto, @CurrentUser() user: PublicUser) {
    return this.paymentsService.reviewReceipt(id, dto, user);
  }
}
