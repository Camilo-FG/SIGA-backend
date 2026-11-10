import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AttendanceStatus, Role } from '../../generated/prisma/client.js';
import { AuditService } from '../../audit/audit.service.js';
import { costaRicaToday, costaRicaWeekday, daysAfter, isEnrolledOn } from '../../common/dates.js';
import type { PublicUser } from '../../users/users.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { RecordAttendanceDto } from './dto/record-attendance.dto.js';
import type { ListAttendanceQueryDto } from './dto/list-attendance-query.dto.js';

const staff = new Set<Role>([Role.DIRECTOR_GENERAL, Role.DIRECTOR_ADMINISTRATIVO, Role.ASISTENTE_DIRECCION]);

export function attendanceRate(records: { status: string; cancelled?: boolean }[]) {
  const counted = records.filter((record) => !record.cancelled && record.status !== AttendanceStatus.JUSTIFICADA);
  const attended = counted.filter((record) => record.status === AttendanceStatus.PRESENTE || record.status === AttendanceStatus.TARDIA).length;
  return counted.length ? Math.round((attended / counted.length) * 100) : 0;
}

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async record(dto: RecordAttendanceDto, user: PublicUser) {
    const date = new Date(dto.date);
    if (Number.isNaN(date.getTime())) throw new BadRequestException('Invalid attendance date');
    const today = costaRicaToday();
    if (dto.date.slice(0, 10) > today) throw new BadRequestException('La fecha no puede ser futura');
    if (!staff.has(user.role) && daysAfter(dto.date, today) > 7) throw new ForbiddenException('El plazo de edición de 7 días ya venció');
    const existing = await this.prisma.attendanceSession.findUnique({ where: { groupId_date: { groupId: dto.groupId, date } } });
    const group = await this.prisma.group.findUnique({ where: { id: dto.groupId }, include: { teachers: true, students: true } });
    if (!group) throw new NotFoundException('Group not found');
    this.assertAssigned(group, user);
    const enrolled = new Set(group.students.filter((student) => isEnrolledOn(student, date)).map((student) => student.studentId));
    const ids = dto.records.map((record) => record.studentId);
    if (new Set(ids).size !== ids.length || ids.some((id) => !enrolled.has(id))) throw new BadRequestException('Attendance records must contain enrolled students without duplicates');
    const saved = await this.prisma.attendanceSession.upsert({
      where: { groupId_date: { groupId: dto.groupId, date } },
      create: { groupId: dto.groupId, date, createdById: user.id, records: { create: dto.records } },
      update: { records: { deleteMany: {}, create: dto.records } },
      include: { records: { include: { student: true } }, group: true },
    });
    if (existing && staff.has(user.role)) await this.audit.log(user.id, 'CORREGIR_ASISTENCIA', 'Sesion', saved.id, { date: dto.date });
    return saved;
  }

  async today(user: PublicUser) {
    const weekday = costaRicaWeekday();
    const today = costaRicaToday();
    const groups = await this.prisma.group.findMany({
      where: { active: true, teachers: { some: { userId: user.id } }, OR: [{ dayOfWeek: weekday }, { schedules: { some: { dayOfWeek: weekday } } }] },
      include: { discipline: true, attendance: { where: { date: new Date(`${today}T00:00:00.000Z`) } } },
    });
    return groups.map((group) => ({ id: group.id, name: group.name, discipline: group.discipline.name, recorded: group.attendance.some((session) => !session.cancelled) }));
  }

  async alerts(threshold = 75) {
    const records = await this.prisma.attendanceRecord.findMany({ include: { student: true, session: true } });
    const byStudent = new Map<string, { student: { id: string; firstName: string; lastName: string }; rows: { status: string; cancelled: boolean }[] }>();
    for (const record of records) {
      const current = byStudent.get(record.studentId) ?? { student: record.student, rows: [] };
      current.rows.push({ status: record.status, cancelled: record.session.cancelled });
      byStudent.set(record.studentId, current);
    }
    return [...byStudent.values()].map((item) => ({ student: item.student, attendanceRate: attendanceRate(item.rows) })).filter((item) => item.attendanceRate < threshold);
  }

  async cancel(sessionId: string, user: PublicUser) {
    const session = await this.prisma.attendanceSession.findUnique({ where: { id: sessionId }, include: { group: { include: { teachers: true } } } });
    if (!session) throw new NotFoundException('Sesión no encontrada');
    this.assertAssigned(session.group, user);
    return this.prisma.attendanceSession.update({ where: { id: sessionId }, data: { cancelled: true } });
  }

  async list(query: ListAttendanceQueryDto, user: PublicUser) {
    const isAdmin = user.role === Role.DIRECTOR_GENERAL || user.role === Role.DIRECTOR_ADMINISTRATIVO || user.role === Role.ASISTENTE_DIRECCION;
    const date = query.from || query.to ? { ...(query.from ? { gte: new Date(query.from) } : {}), ...(query.to ? { lte: new Date(query.to) } : {}) } : undefined;
    const sessions = await this.prisma.attendanceSession.findMany({ where: { ...(query.groupId ? { groupId: query.groupId } : {}), ...(date ? { date } : {}), ...(query.studentId ? { records: { some: { studentId: query.studentId } } } : {}), ...(!isAdmin ? { group: { teachers: { some: { userId: user.id } } } } : {}) }, include: { records: { include: { student: true } }, group: true }, orderBy: { date: 'desc' } });
    const records = sessions.filter((session) => !session.cancelled).flatMap((session) => session.records);
    const active = records;
    const present = active.filter((record) => record.status === 'PRESENTE').length;
    const late = active.filter((record) => record.status === 'TARDIA').length;
    const justified = active.filter((record) => record.status === 'JUSTIFICADA').length;
    return { sessions, summary: { total: active.length, present, late, absent: active.length - present - late - justified, justified, attendanceRate: attendanceRate(active.map((record) => ({ status: record.status }))) } };
  }

  async roster(groupId: string, dateValue: string, user: PublicUser) {
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) throw new BadRequestException('Invalid attendance date');
    const group = await this.prisma.group.findUnique({ where: { id: groupId }, include: { teachers: true, students: { include: { student: true } } } });
    if (!group) throw new NotFoundException('Group not found');
    this.assertAssigned(group, user);
    return group.students.filter((student) => isEnrolledOn(student, date)).map((student) => student.student);
  }

  private assertAssigned(group: { teachers: { userId: string }[] }, user: PublicUser) {
    const isAdmin = user.role === Role.DIRECTOR_GENERAL || user.role === Role.DIRECTOR_ADMINISTRATIVO || user.role === Role.ASISTENTE_DIRECCION;
    if (!isAdmin && !group.teachers.some((teacher) => teacher.userId === user.id)) throw new ForbiddenException('You are not assigned to this group');
  }
}
