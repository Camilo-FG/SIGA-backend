import { Injectable } from '@nestjs/common';
import { Role } from '../../generated/prisma/client.js';
import { overdueChargeWhere, pendingChargeWhere } from '../payments/charge-status.js';
import type { PublicUser } from '../../users/users.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(user: PublicUser) {
    const isStaff = user.role === Role.DIRECTOR_GENERAL || user.role === Role.DIRECTOR_ADMINISTRATIVO || user.role === Role.ASISTENTE_DIRECCION;
    const groupFilter = isStaff ? {} : { teachers: { some: { userId: user.id } } };
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const [activeStudents, groups, sessions, pendingCharges, overdueCharges, weeklySessions, paymentsThisMonth] = await Promise.all([
      this.prisma.student.count({ where: isStaff ? { enrollmentStatus: 'ACTIVE' } : { enrollmentStatus: 'ACTIVE', groups: { some: { endedAt: null, group: { active: true, discipline: { active: true }, teachers: { some: { userId: user.id } } } } } } }),
      this.prisma.group.count({ where: { active: true, discipline: { active: true }, ...groupFilter } }),
      this.prisma.attendanceSession.findMany({ where: { group: groupFilter }, include: { records: true }, orderBy: { date: 'desc' }, take: 30 }),
      isStaff ? this.prisma.charge.count({ where: pendingChargeWhere() }) : Promise.resolve(undefined),
      isStaff ? this.prisma.charge.count({ where: overdueChargeWhere() }) : Promise.resolve(undefined),
      isStaff ? this.prisma.attendanceSession.findMany({ where: { date: { gte: weekAgo }, group: { active: true, discipline: { active: true } } }, distinct: ['groupId'], select: { groupId: true } }) : Promise.resolve(undefined),
      isStaff ? this.prisma.payment.count({ where: { receivedAt: { gte: monthStart } } }) : Promise.resolve(undefined),
    ]);
    const records = sessions.flatMap((session) => session.records);
    const present = records.filter((record) => record.status === 'PRESENTE').length;
    const late = records.filter((record) => record.status === 'TARDIA').length;
    const adoption = isStaff ? { weeklyAttendanceCoverage: groups ? Math.round(((weeklySessions?.length ?? 0) / groups) * 100) : 0, paymentsRegisteredThisMonth: paymentsThisMonth ?? 0 } : undefined;
    return { activeStudents, groups, ...(isStaff ? { pendingCharges, overdueCharges, adoption } : {}), attendance: { sessions: sessions.length, present, late, absent: records.length - present - late } };
  }

  async studentsByDiscipline() {
    const groups = await this.prisma.group.findMany({ where: { active: true, discipline: { active: true } }, include: { discipline: true, students: { where: { endedAt: null, student: { enrollmentStatus: 'ACTIVE' } }, select: { studentId: true } } } });
    const counts = new Map<string, Set<string>>();
    for (const group of groups) {
      const ids = counts.get(group.discipline.name) ?? new Set<string>();
      group.students.forEach((item) => ids.add(item.studentId));
      counts.set(group.discipline.name, ids);
    }
    return [...counts].map(([name, ids]) => ({ name, students: ids.size }));
  }

  async attendanceTrend(months = 6) {
    const from = new Date();
    from.setUTCMonth(from.getUTCMonth() - (months - 1));
    from.setUTCDate(1);
    const sessions = await this.prisma.attendanceSession.findMany({ where: { cancelled: false, date: { gte: from } }, include: { records: true } });
    const buckets = new Map<string, { attended: number; counted: number }>();
    for (const session of sessions) {
      const key = session.date.toISOString().slice(0, 7);
      const bucket = buckets.get(key) ?? { attended: 0, counted: 0 };
      for (const record of session.records) {
        if (record.status === 'JUSTIFICADA') continue;
        bucket.counted += 1;
        if (record.status === 'PRESENTE' || record.status === 'TARDIA') bucket.attended += 1;
      }
      buckets.set(key, bucket);
    }
    return [...buckets].map(([month, bucket]) => ({ month, attendanceRate: bucket.counted ? Math.round((bucket.attended / bucket.counted) * 100) : 0 }));
  }

  async collection(months = 6) {
    const from = new Date();
    from.setUTCMonth(from.getUTCMonth() - (months - 1));
    const [payments, charges] = await Promise.all([
      this.prisma.payment.findMany({ where: { receiptStatus: 'APROBADO', receivedAt: { gte: from } } }),
      this.prisma.charge.findMany({ where: { status: { not: 'CANCELADO' }, createdAt: { gte: from } }, include: { payments: true } }),
    ]);
    const buckets = new Map<string, { collected: number; pending: number }>();
    for (const payment of payments) {
      const key = payment.receivedAt.toISOString().slice(0, 7);
      const bucket = buckets.get(key) ?? { collected: 0, pending: 0 };
      bucket.collected += Number(payment.amount);
      buckets.set(key, bucket);
    }
    for (const charge of charges) {
      const key = charge.createdAt.toISOString().slice(0, 7);
      const bucket = buckets.get(key) ?? { collected: 0, pending: 0 };
      const paid = charge.payments.filter((payment) => payment.receiptStatus === 'APROBADO').reduce((sum, payment) => sum + Number(payment.amount), 0);
      bucket.pending += Math.max(0, Number(charge.amount) - paid);
      buckets.set(key, bucket);
    }
    return [...buckets].map(([month, bucket]) => ({ month, ...bucket }));
  }

  async upcoming() {
    const groups = await this.prisma.group.findMany({ where: { active: true }, include: { schedules: true, discipline: true } });
    const events = [];
    for (let offset = 0; offset < 7; offset += 1) {
      const day = new Date();
      day.setUTCDate(day.getUTCDate() + offset);
      for (const group of groups) {
        const slots = group.schedules.length ? group.schedules : group.dayOfWeek == null ? [] : [{ dayOfWeek: group.dayOfWeek, startTime: group.startTime, endTime: group.endTime, location: group.location }];
        for (const slot of slots) {
          if (slot.dayOfWeek === day.getUTCDay()) events.push({ date: day.toISOString().slice(0, 10), group: group.name, discipline: group.discipline.name, startTime: slot.startTime, endTime: slot.endTime, location: slot.location });
        }
      }
    }
    return events;
  }
}
