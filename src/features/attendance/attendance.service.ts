import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '../../generated/prisma/client.js';
import type { PublicUser } from '../../users/users.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { RecordAttendanceDto } from './dto/record-attendance.dto.js';
import type { ListAttendanceQueryDto } from './dto/list-attendance-query.dto.js';

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  async record(dto: RecordAttendanceDto, user: PublicUser) {
    const date = new Date(dto.date);
    if (Number.isNaN(date.getTime())) throw new BadRequestException('Invalid attendance date');
    const group = await this.prisma.group.findUnique({ where: { id: dto.groupId }, include: { teachers: true, students: true } });
    if (!group) throw new NotFoundException('Group not found');
    const isAdmin = user.role === Role.DIRECTOR_GENERAL || user.role === Role.DIRECTOR_ADMINISTRATIVO || user.role === Role.ASISTENTE_DIRECCION;
    if (!isAdmin && !group.teachers.some((teacher) => teacher.userId === user.id)) throw new ForbiddenException('You are not assigned to this group');
    const enrolled = new Set(group.students.map((student) => student.studentId));
    const ids = dto.records.map((record) => record.studentId);
    if (new Set(ids).size !== ids.length || ids.some((id) => !enrolled.has(id))) throw new BadRequestException('Attendance records must contain enrolled students without duplicates');
    return this.prisma.attendanceSession.upsert({
      where: { groupId_date: { groupId: dto.groupId, date } },
      create: { groupId: dto.groupId, date, createdById: user.id, records: { create: dto.records } },
      update: { records: { deleteMany: {}, create: dto.records } },
      include: { records: { include: { student: true } }, group: true },
    });
  }

  async list(query: ListAttendanceQueryDto, user: PublicUser) {
    const isAdmin = user.role === Role.DIRECTOR_GENERAL || user.role === Role.DIRECTOR_ADMINISTRATIVO || user.role === Role.ASISTENTE_DIRECCION;
    const date = query.from || query.to ? { ...(query.from ? { gte: new Date(query.from) } : {}), ...(query.to ? { lte: new Date(query.to) } : {}) } : undefined;
    const sessions = await this.prisma.attendanceSession.findMany({ where: { ...(query.groupId ? { groupId: query.groupId } : {}), ...(date ? { date } : {}), ...(query.studentId ? { records: { some: { studentId: query.studentId } } } : {}), ...(!isAdmin ? { group: { teachers: { some: { userId: user.id } } } } : {}) }, include: { records: { include: { student: true } }, group: true }, orderBy: { date: 'desc' } });
    const records = sessions.flatMap((session) => session.records);
    const present = records.filter((record) => record.status === 'PRESENTE').length;
    const late = records.filter((record) => record.status === 'TARDIA').length;
    return { sessions, summary: { total: records.length, present, late, absent: records.length - present - late, attendanceRate: records.length ? Math.round((present / records.length) * 100) : 0 } };
  }
}
