import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ChargeStatus, ReceiptStatus } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateChargeDto } from './dto/create-charge.dto.js';
import type { CreatePaymentDto } from './dto/create-payment.dto.js';
import type { ReviewReceiptDto } from './dto/review-receipt.dto.js';

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  list(studentId?: string, status?: ChargeStatus) {
    return this.prisma.charge.findMany({ where: { ...(studentId ? { studentId } : {}), ...(status ? { status } : {}) }, include: { student: true, payments: true }, orderBy: [{ status: 'asc' }, { dueDate: 'asc' }] });
  }

  async createCharge(dto: CreateChargeDto) {
    const student = await this.prisma.student.findUnique({ where: { id: dto.studentId } });
    if (!student) throw new NotFoundException('Student not found');
    try { return await this.prisma.charge.create({ data: { studentId: dto.studentId, concept: dto.concept.trim(), amount: dto.amount, period: dto.period.trim(), dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined }, include: { student: true, payments: true } }); }
    catch { throw new ConflictException('Charge already exists for this student and period'); }
  }

  async createPayment(dto: CreatePaymentDto) {
    const charge = await this.prisma.charge.findUnique({ where: { id: dto.chargeId }, include: { payments: true } });
    if (!charge) throw new NotFoundException('Charge not found');
    if (charge.status === ChargeStatus.CANCELADO || charge.payments.length > 0) throw new ConflictException('This charge already has a payment or is cancelled');
    if (Number(charge.amount) !== dto.amount) throw new ConflictException('Partial payments are not supported');
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({ data: { chargeId: dto.chargeId, amount: dto.amount, receivedAt: dto.receivedAt ? new Date(dto.receivedAt) : undefined, reference: dto.reference?.trim(), receiptUrl: dto.receiptUrl?.trim() } });
      await tx.charge.update({ where: { id: dto.chargeId }, data: { status: ReceiptStatus.APROBADO === payment.receiptStatus ? ChargeStatus.PAGADO : ChargeStatus.PENDIENTE } });
      return payment;
    });
  }

  async reviewReceipt(paymentId: string, dto: ReviewReceiptDto) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException('Payment not found');
    return this.prisma.$transaction(async (tx) => {
      const reviewed = await tx.payment.update({ where: { id: paymentId }, data: { receiptStatus: dto.status } });
      await tx.charge.update({ where: { id: payment.chargeId }, data: { status: dto.status === ReceiptStatus.APROBADO ? ChargeStatus.PAGADO : ChargeStatus.PENDIENTE } });
      return reviewed;
    });
  }
}
