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
    const [activeStudents, groups, sessions, pendingCharges, overdueCharges] = await Promise.all([
      this.prisma.student.count({ where: isStaff ? { enrollmentStatus: 'ACTIVE' } : { enrollmentStatus: 'ACTIVE', groups: { some: { endedAt: null, group: { active: true, discipline: { active: true }, teachers: { some: { userId: user.id } } } } } } }),
      this.prisma.group.count({ where: { active: true, discipline: { active: true }, ...groupFilter } }),
      this.prisma.attendanceSession.findMany({ where: { group: groupFilter }, include: { records: true }, orderBy: { date: 'desc' }, take: 30 }),
      isStaff ? this.prisma.charge.count({ where: pendingChargeWhere() }) : Promise.resolve(undefined),
      isStaff ? this.prisma.charge.count({ where: overdueChargeWhere() }) : Promise.resolve(undefined),
    ]);
    const records = sessions.flatMap((session) => session.records);
    const present = records.filter((record) => record.status === 'PRESENTE').length;
    const late = records.filter((record) => record.status === 'TARDIA').length;
    return { activeStudents, groups, ...(isStaff ? { pendingCharges, overdueCharges } : {}), attendance: { sessions: sessions.length, present, late, absent: records.length - present - late } };
  }
}
