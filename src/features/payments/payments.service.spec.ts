import { BadRequestException, ConflictException } from '@nestjs/common';
import { ChargeStatus, ReceiptStatus } from '../../generated/prisma/client.js';
import { PaymentsService } from './payments.service.js';

const chargeInput = { studentId: 'student-1', concept: 'Mensualidad', amount: 15000, period: '2026-10' };

describe('PaymentsService', () => {
  it('rejects a duplicate charge for the same student, concept and period', async () => {
    const prisma = {
      student: { findUnique: () => ({ id: 'student-1' }) },
      charge: { create: () => { throw new Error('Unique constraint failed'); } },
    };
    const service = new PaymentsService(prisma as never, { log: async () => undefined } as never, {} as never);

    await expect(service.createCharge(chargeInput)).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects a period that is not a month', async () => {
    const service = new PaymentsService({} as never, { log: async () => undefined } as never, {} as never);

    await expect(service.createCharge({ ...chargeInput, period: 'texto libre' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('marks the charge paid when the receipt is approved', async () => {
    const chargeUpdate = vi.fn(() => ({}));
    const service = serviceFor(ReceiptStatus.APROBADO, chargeUpdate);

    await service.reviewReceipt('payment-1', { status: ReceiptStatus.APROBADO }, { id: 'admin-1' } as never);

    expect(chargeUpdate).toHaveBeenCalledWith({ where: { id: 'charge-1' }, data: { status: ChargeStatus.PAGADO } });
  });

  it('leaves the charge pending when the receipt is rejected', async () => {
    const chargeUpdate = vi.fn(() => ({}));
    const service = serviceFor(ReceiptStatus.RECHAZADO, chargeUpdate);

    await service.reviewReceipt('payment-1', { status: ReceiptStatus.RECHAZADO, reason: 'Ilegible' }, { id: 'admin-1' } as never);

    expect(chargeUpdate).toHaveBeenCalledWith({ where: { id: 'charge-1' }, data: { status: ChargeStatus.PENDIENTE } });
  });

  it('shows a pending charge as overdue when its due date has passed, without storing that status', async () => {
    const update = vi.fn();
    const prisma = {
      charge: {
        findMany: () => [
          { id: 'past', status: ChargeStatus.PENDIENTE, dueDate: new Date('2020-01-01T00:00:00.000Z'), payments: [] },
          { id: 'future', status: ChargeStatus.PENDIENTE, dueDate: new Date('2999-01-01T00:00:00.000Z'), payments: [] },
        ],
        count: () => 2,
        update,
      },
    };
    const service = new PaymentsService(prisma as never, { log: async () => undefined } as never, {} as never);

    const charges = await service.list();

    expect(charges.data.map((charge) => charge.status)).toEqual([ChargeStatus.VENCIDO, ChargeStatus.PENDIENTE]);
    expect(update).not.toHaveBeenCalled();
  });

  it('rejects a payment above the remaining balance', async () => {
    const prisma = {
      charge: { findUnique: () => ({ id: 'charge-1', status: ChargeStatus.PENDIENTE, amount: 1000, payments: [{ amount: 800, receiptStatus: ReceiptStatus.APROBADO }] }) },
    };
    const service = new PaymentsService(prisma as never, { log: async () => undefined } as never, {} as never);
    await expect(service.createPayment({ chargeId: 'charge-1', amount: 300 }, { id: 'admin-1' } as never)).rejects.toBeInstanceOf(BadRequestException);
  });
});

function serviceFor(receiptStatus: ReceiptStatus, chargeUpdate: ReturnType<typeof vi.fn>) {
  const tx = {
    payment: { update: () => ({ id: 'payment-1', chargeId: 'charge-1', receiptStatus }) },
    charge: { update: chargeUpdate },
    auditLog: { create: () => ({}) },
  };
  const prisma = {
    payment: { findUnique: () => ({ id: 'payment-1', chargeId: 'charge-1', amount: 15000, receiptStatus: ReceiptStatus.PENDIENTE, charge: { id: 'charge-1', amount: 15000, payments: [] } }) },
    $transaction: (work: (client: typeof tx) => Promise<unknown>) => work(tx),
  };
  return new PaymentsService(prisma as never, { log: async () => undefined } as never, {} as never);
}
