import { ConflictException } from '@nestjs/common';
import { ChargeStatus, ReceiptStatus } from '../../generated/prisma/client.js';
import { PaymentsService } from './payments.service.js';

const chargeInput = { studentId: 'student-1', concept: 'Mensualidad', amount: 15000, period: '2026-10' };

describe('PaymentsService', () => {
  it('rejects a duplicate charge for the same student, concept and period', async () => {
    const prisma = {
      student: { findUnique: async () => ({ id: 'student-1' }) },
      charge: { create: async () => { throw new Error('Unique constraint failed'); } },
    };
    const service = new PaymentsService(prisma as never);

    await expect(service.createCharge(chargeInput)).rejects.toBeInstanceOf(ConflictException);
  });

  it('marks the charge paid when the receipt is approved', async () => {
    const chargeUpdate = vi.fn(async () => ({}));
    const service = serviceFor(ReceiptStatus.APROBADO, chargeUpdate);

    await service.reviewReceipt('payment-1', { status: ReceiptStatus.APROBADO });

    expect(chargeUpdate).toHaveBeenCalledWith({ where: { id: 'charge-1' }, data: { status: ChargeStatus.PAGADO } });
  });

  it('leaves the charge pending when the receipt is rejected', async () => {
    const chargeUpdate = vi.fn(async () => ({}));
    const service = serviceFor(ReceiptStatus.RECHAZADO, chargeUpdate);

    await service.reviewReceipt('payment-1', { status: ReceiptStatus.RECHAZADO });

    expect(chargeUpdate).toHaveBeenCalledWith({ where: { id: 'charge-1' }, data: { status: ChargeStatus.PENDIENTE } });
  });

  it('shows a pending charge as overdue when its due date has passed, without storing that status', async () => {
    const update = vi.fn();
    const prisma = {
      charge: {
        findMany: async () => [
          { id: 'past', status: ChargeStatus.PENDIENTE, dueDate: new Date('2020-01-01T00:00:00.000Z'), payments: [] },
          { id: 'future', status: ChargeStatus.PENDIENTE, dueDate: new Date('2999-01-01T00:00:00.000Z'), payments: [] },
        ],
        update,
      },
    };
    const service = new PaymentsService(prisma as never);

    const charges = await service.list();

    expect(charges.map((charge) => charge.status)).toEqual([ChargeStatus.VENCIDO, ChargeStatus.PENDIENTE]);
    expect(update).not.toHaveBeenCalled();
  });
});

function serviceFor(receiptStatus: ReceiptStatus, chargeUpdate: ReturnType<typeof vi.fn>) {
  const tx = {
    payment: { update: async () => ({ id: 'payment-1', chargeId: 'charge-1', receiptStatus }) },
    charge: { update: chargeUpdate },
  };
  const prisma = {
    payment: { findUnique: async () => ({ id: 'payment-1', chargeId: 'charge-1' }) },
    $transaction: async (work: (client: typeof tx) => Promise<unknown>) => work(tx),
  };
  return new PaymentsService(prisma as never);
}
