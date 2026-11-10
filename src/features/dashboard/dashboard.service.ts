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
}
