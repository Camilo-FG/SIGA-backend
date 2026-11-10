import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ChargeStatus, PaymentMethod, PaymentPeriodicity, ReceiptStatus, Role } from '../../generated/prisma/client.js';
import { AuditService } from '../../audit/audit.service.js';
import { pageResult, pageWindow } from '../../common/page.js';
import { FilesService, type UploadedFile } from '../../files/files.service.js';
import type { PublicUser } from '../../users/users.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { displayChargeStatus, overdueChargeWhere, pendingChargeWhere } from './charge-status.js';
import type { CreateChargeDto } from './dto/create-charge.dto.js';
import type { CreatePaymentDto } from './dto/create-payment.dto.js';
import type { ReviewReceiptDto } from './dto/review-receipt.dto.js';

const chargeInclude = { student: true, payments: true } as const;

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly files: FilesService,
  ) {}

  async list(studentId?: string, status?: ChargeStatus, page = 1, limit = 50) {
    const window = pageWindow(page, limit);
    const statusFilter = status === ChargeStatus.VENCIDO ? overdueChargeWhere() : status === ChargeStatus.PENDIENTE ? pendingChargeWhere() : status ? { status } : {};
    const where = { ...(studentId ? { studentId } : {}), ...statusFilter };
    const [charges, total] = await Promise.all([
      this.prisma.charge.findMany({ where, include: chargeInclude, orderBy: [{ dueDate: 'asc' }], skip: window.skip, take: window.limit }),
      this.prisma.charge.count({ where }),
    ]);
    return pageResult(charges.map((charge) => ({ ...charge, status: displayChargeStatus(charge.status, charge.dueDate), balance: this.balance(charge) })), total, window.page, window.limit);
  }

  listConcepts() {
    return this.prisma.paymentConcept.findMany({ where: { active: true }, orderBy: { name: 'asc' } });
  }

  createConcept(input: { name: string; amount: number; periodicity: PaymentPeriodicity }) {
    return this.prisma.paymentConcept.create({ data: { name: input.name.trim(), amount: input.amount, periodicity: input.periodicity } });
  }

  async updateConcept(id: string, input: { name?: string; amount?: number; active?: boolean }) {
    const concept = await this.prisma.paymentConcept.findUnique({ where: { id } });
    if (!concept) throw new NotFoundException('Concepto no encontrado');
    return this.prisma.paymentConcept.update({ where: { id }, data: { ...input, name: input.name?.trim() } });
  }

  async createCharge(dto: CreateChargeDto) {
    const period = billingPeriod(dto.period);
    const student = await this.prisma.student.findUnique({ where: { id: dto.studentId } });
    if (!student) throw new NotFoundException('Student not found');
    try { return await this.prisma.charge.create({ data: { studentId: dto.studentId, concept: dto.concept.trim(), amount: dto.amount, period, dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined }, include: chargeInclude }); }
    catch { throw new ConflictException('Charge already exists for this student and period'); }
  }

  async generateMonthly(input: { period: string; conceptId: string; dueDate: string }) {
    const period = billingPeriod(input.period);
    const concept = await this.prisma.paymentConcept.findUnique({ where: { id: input.conceptId } });
    if (!concept || !concept.active) throw new NotFoundException('Concepto no encontrado');
    const students = await this.prisma.student.findMany({ where: { enrollmentStatus: 'ACTIVE' }, select: { id: true } });
    let created = 0;
    for (const student of students) {
      try {
        await this.prisma.charge.create({ data: { studentId: student.id, concept: concept.name, amount: concept.amount, period, dueDate: new Date(input.dueDate) } });
        created += 1;
      } catch {
        // The unique student/concept/period constraint makes the generation idempotent.
      }
    }
    return { created, skipped: students.length - created };
  }

  async annulCharge(id: string, reason: string, actor: PublicUser) {
    if (actor.role !== Role.DIRECTOR_ADMINISTRATIVO) throw new ConflictException('Solo la dirección administrativa puede anular un cargo');
    const charge = await this.prisma.charge.findUnique({ where: { id } });
    if (!charge) throw new NotFoundException('Charge not found');
    const updated = await this.prisma.charge.update({ where: { id }, data: { status: ChargeStatus.CANCELADO, annulReason: reason.trim() } });
    await this.audit.log(actor.id, 'ANULAR_CARGO', 'Cargo', id, { reason });
    return updated;
  }

  async createPayment(dto: CreatePaymentDto, actor: PublicUser, file?: UploadedFile) {
    const charge = await this.prisma.charge.findUnique({ where: { id: dto.chargeId }, include: { payments: true } });
    if (!charge || charge.status === ChargeStatus.CANCELADO) throw new NotFoundException('Charge not found');
    const due = this.balance(charge);
    if (dto.amount <= 0 || dto.amount > due) throw new BadRequestException('El monto debe ser mayor a cero y no superar el saldo');
    const receiptUrl = file ? await this.files.save('receipts', file, ['image/jpeg', 'image/png', 'application/pdf'], 5 * 1024 * 1024) : dto.receiptUrl?.trim();
    return this.prisma.payment.create({
      data: {
        chargeId: dto.chargeId,
        amount: dto.amount,
        receivedAt: dto.receivedAt ? new Date(dto.receivedAt) : undefined,
        reference: dto.reference?.trim(),
        receiptUrl,
        method: dto.method ?? PaymentMethod.EFECTIVO,
        registeredById: actor.id,
      },
    });
  }

  async reviewReceipt(paymentId: string, dto: ReviewReceiptDto, actor: PublicUser) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId }, include: { charge: { include: { payments: true } } } });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.receiptStatus !== ReceiptStatus.PENDIENTE) throw new ConflictException('Solo se puede revisar un pago pendiente');
    if (dto.status === ReceiptStatus.RECHAZADO && !dto.reason?.trim()) throw new BadRequestException('El rechazo requiere un motivo');
    return this.prisma.$transaction(async (tx) => {
      const reviewed = await tx.payment.update({
        where: { id: paymentId },
        data: { receiptStatus: dto.status, rejectionReason: dto.reason?.trim(), validatedById: actor.id, validatedAt: new Date() },
      });
      const approved = payment.charge.payments
        .filter((item) => item.id !== payment.id && item.receiptStatus === ReceiptStatus.APROBADO)
        .reduce((sum, item) => sum + Number(item.amount), 0) + (dto.status === ReceiptStatus.APROBADO ? Number(payment.amount) : 0);
      await tx.charge.update({
        where: { id: payment.chargeId },
        data: { status: approved >= Number(payment.charge.amount) ? ChargeStatus.PAGADO : ChargeStatus.PENDIENTE },
      });
      await tx.auditLog.create({
        data: {
          userId: actor.id,
          action: dto.status === ReceiptStatus.APROBADO ? 'VALIDAR_PAGO' : 'RECHAZAR_PAGO',
          entity: 'Pago',
          entityId: paymentId,
          detail: { reason: dto.reason ?? null },
        },
      });
      return reviewed;
    });
  }

  async delinquency(period?: string) {
    const charges = await this.prisma.charge.findMany({
      where: { ...(period ? { period } : {}), ...overdueChargeWhere() },
      include: chargeInclude,
    });
    const today = new Date();
    return charges
      .map((charge) => ({ student: charge.student, concept: charge.concept, period: charge.period, balance: this.balance(charge), daysOverdue: charge.dueDate ? Math.floor((today.getTime() - charge.dueDate.getTime()) / 86_400_000) : 0 }))
      .filter((row) => row.balance > 0);
  }

  async statement(studentId: string) {
    const charges = await this.prisma.charge.findMany({ where: { studentId }, include: { payments: true }, orderBy: { period: 'desc' } });
    const balance = charges.filter((charge) => charge.status !== ChargeStatus.CANCELADO).reduce((sum, charge) => sum + this.balance(charge), 0);
    return { charges, balance };
  }

  async openReceipt(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment?.receiptUrl || payment.receiptUrl.startsWith('http')) throw new NotFoundException('Comprobante no encontrado');
    const { createReadStream } = await import('node:fs');
    return createReadStream(this.files.absolute(payment.receiptUrl));
  }

  private balance(charge: { status: ChargeStatus; amount: { toString(): string } | number; payments: { amount: { toString(): string } | number; receiptStatus: ReceiptStatus }[] }) {
    if (charge.status === ChargeStatus.CANCELADO) return 0;
    const paid = charge.payments.filter((payment) => payment.receiptStatus === ReceiptStatus.APROBADO).reduce((sum, payment) => sum + Number(payment.amount), 0);
    return Math.max(0, Number(charge.amount) - paid);
  }
}

function billingPeriod(value: string) {
  const period = value.trim();
  if (!/^(19|20)\d{2}-(0[1-9]|1[0-2])$/.test(period)) throw new BadRequestException('El período debe ser un mes, por ejemplo 2026-11.');
  return period;
}
