import { Injectable } from '@nestjs/common';
import { ChargeStatus, Role } from '../../generated/prisma/client.js';
import type { PublicUser } from '../../users/users.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(user: PublicUser) {
    const isStaff = user.role === Role.DIRECTOR_GENERAL || user.role === Role.DIRECTOR_ADMINISTRATIVO || user.role === Role.ASISTENTE_DIRECCION;
    const groupFilter = isStaff ? {} : { teachers: { some: { userId: user.id } } };
    const [activeStudents, groups, pendingCharges, overdueCharges, sessions] = await Promise.all([
      this.prisma.student.count({ where: { enrollmentStatus: 'ACTIVE' } }),
      this.prisma.group.count({ where: { active: true, ...groupFilter } }),
      this.prisma.charge.count({ where: { status: ChargeStatus.PENDIENTE } }),
      this.prisma.charge.count({ where: { status: ChargeStatus.VENCIDO } }),
      this.prisma.attendanceSession.findMany({ where: { group: groupFilter }, include: { records: true }, orderBy: { date: 'desc' }, take: 30 }),
    ]);
    const records = sessions.flatMap((session) => session.records);
    const present = records.filter((record) => record.status === 'PRESENTE').length;
    const late = records.filter((record) => record.status === 'TARDIA').length;
    return { activeStudents, groups, pendingCharges, overdueCharges, attendance: { sessions: sessions.length, present, late, absent: records.length - present - late } };
  }
}
