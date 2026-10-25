import { ChargeStatus } from '../../generated/prisma/client.js';
import { startOfUtcDay } from '../../common/dates.js';

/** Pending charges past their due date are shown as overdue. The stored status stays pending until a receipt is approved. */
export function displayChargeStatus(status: ChargeStatus, dueDate: Date | null | undefined, now = new Date()): ChargeStatus {
  if (status === ChargeStatus.PENDIENTE && dueDate && dueDate < startOfUtcDay(now)) return ChargeStatus.VENCIDO;
  return status;
}

export function pendingChargeWhere(now = new Date()) {
  const today = startOfUtcDay(now);
  return { status: ChargeStatus.PENDIENTE, OR: [{ dueDate: null }, { dueDate: { gte: today } }] };
}

export function overdueChargeWhere(now = new Date()) {
  const today = startOfUtcDay(now);
  return {
    OR: [
      { status: ChargeStatus.VENCIDO },
      { status: ChargeStatus.PENDIENTE, dueDate: { lt: today } },
    ],
  };
}
