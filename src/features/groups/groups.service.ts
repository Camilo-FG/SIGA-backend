import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EnrollmentStatus, Role } from '../../generated/prisma/client.js';
import type { PublicUser } from '../../users/users.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { CreateDisciplineDto } from './dto/create-discipline.dto.js';
import type { CreateGroupDto } from './dto/create-group.dto.js';
import type { UpdateGroupDto } from './dto/update-group.dto.js';

const groupInclude = {
  discipline: true,
  teachers: { include: { user: { select: { id: true, name: true, email: true, role: true } } } },
  students: { where: { endedAt: null }, include: { student: true } },
} as const;

type Schedule = { dayOfWeek?: number | null; startTime?: string | null; endTime?: string | null; location?: string | null };

@Injectable()
export class GroupsService {
  constructor(private readonly prisma: PrismaService) {}

  listDisciplines() {
    return this.prisma.discipline.findMany({ where: { active: true }, orderBy: { name: 'asc' } });
  }

  async createDiscipline(dto: CreateDisciplineDto) {
    try {
      return await this.prisma.discipline.create({ data: { name: dto.name.trim() } });
    } catch {
      throw new ConflictException('Discipline already exists');
    }
  }

  async deactivateDiscipline(id: string) {
    const discipline = await this.prisma.discipline.findUnique({ where: { id } });
    if (!discipline) throw new NotFoundException('Discipline not found');
    return this.prisma.discipline.update({ where: { id }, data: { active: false } });
  }

  listGroups(user: PublicUser) {
    const isStaff = user.role === Role.DIRECTOR_GENERAL || user.role === Role.DIRECTOR_ADMINISTRATIVO || user.role === Role.ASISTENTE_DIRECCION;
    return this.prisma.group.findMany({
      where: { active: true, discipline: { active: true }, ...(isStaff ? {} : { teachers: { some: { userId: user.id } } }) },
      include: groupInclude,
      orderBy: { name: 'asc' },
    });
  }

  async createGroup(dto: CreateGroupDto) {
    const discipline = await this.prisma.discipline.findUnique({ where: { id: dto.disciplineId } });
    if (!discipline) throw new NotFoundException('Discipline not found');
    if (!discipline.active) throw new ConflictException('Inactive discipline cannot be used');
    await this.ensureScheduleAvailable(dto, discipline.id);
    try {
      return await this.prisma.group.create({ data: { ...dto, name: dto.name.trim(), location: dto.location?.trim() }, include: groupInclude });
    } catch {
      throw new ConflictException('Group already exists for this discipline');
    }
  }

  async updateGroup(id: string, dto: UpdateGroupDto) {
    const group = await this.ensureGroup(id);
    const discipline = await this.prisma.discipline.findUnique({ where: { id: dto.disciplineId } });
    if (!discipline) throw new NotFoundException('Discipline not found');
    if (!discipline.active) throw new ConflictException('Inactive discipline cannot be used');
    await this.ensureScheduleAvailable(dto, discipline.id, id);
    try {
      return await this.prisma.group.update({ where: { id: group.id }, data: { ...dto, name: dto.name.trim(), location: dto.location?.trim() }, include: groupInclude });
    } catch {
      throw new ConflictException('Group already exists for this discipline');
    }
  }

  async deactivateGroup(id: string) {
    const group = await this.ensureGroup(id);
    return this.prisma.group.update({ where: { id: group.id }, data: { active: false }, include: groupInclude });
  }

  async assignTeacher(groupId: string, userId: string) {
    const group = await this.ensureOperableGroup(groupId);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || (user.role !== Role.PROFESOR && user.role !== Role.COREOGRAFO)) throw new NotFoundException('Assigned teacher not found or invalid role');
    await this.ensureTeacherFree(userId, group, group.id);
    return this.prisma.groupTeacher.upsert({
      where: { groupId_userId: { groupId, userId } },
      create: { groupId, userId },
      update: {},
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
    });
  }

  async removeTeacher(groupId: string, userId: string) {
    await this.ensureGroup(groupId);
    const link = await this.prisma.groupTeacher.findUnique({ where: { groupId_userId: { groupId, userId } } });
    if (!link) throw new NotFoundException('El docente no está en este grupo');
    await this.prisma.groupTeacher.delete({ where: { groupId_userId: { groupId, userId } } });
    return { removed: true };
  }

  async assignStudent(groupId: string, studentId: string) {
    const group = await this.ensureOperableGroup(groupId);
    const student = await this.prisma.student.findUnique({ where: { id: studentId } });
    if (!student) throw new NotFoundException('Student not found');
    if (student.enrollmentStatus === EnrollmentStatus.INACTIVE) throw new ConflictException('Inactive student cannot be enrolled');
    const where = { studentId_groupId: { studentId, groupId: group.id } };
    const existing = await this.prisma.studentGroup.findUnique({ where });
    const period = { startedAt: new Date(), endedAt: null };
    if (existing && !existing.endedAt) return this.prisma.studentGroup.findUnique({ where, include: { student: true } });
    if (existing) return this.prisma.studentGroup.update({ where, data: period, include: { student: true } });
    return this.prisma.studentGroup.create({ data: { studentId, groupId: group.id, ...period }, include: { student: true } });
  }

  async addSchedule(groupId: string, input: { dayOfWeek: number; startTime: string; endTime: string; location?: string }) {
    const group = await this.ensureOperableGroup(groupId);
    await this.ensureSlotFree({ ...input, location: input.location ?? null }, group.id);
    const teachers = await this.prisma.groupTeacher.findMany({ where: { groupId: group.id }, select: { userId: true } });
    for (const teacher of teachers) {
      await this.ensureTeacherFree(teacher.userId, input, group.id);
      const busy = await this.prisma.groupSchedule.findFirst({
        where: { dayOfWeek: input.dayOfWeek, startTime: { lt: input.endTime }, endTime: { gt: input.startTime }, group: { active: true, id: { not: group.id }, teachers: { some: { userId: teacher.userId } } } },
      });
      if (busy) throw new ConflictException('Teacher has a conflicting schedule');
    }
    return this.prisma.groupSchedule.create({ data: { groupId: group.id, dayOfWeek: input.dayOfWeek, startTime: input.startTime, endTime: input.endTime, location: input.location?.trim() } });
  }

  async enrollMany(groupId: string, studentIds: string[]) {
    const created = [];
    for (const studentId of studentIds) created.push(await this.assignStudent(groupId, studentId));
    return created;
  }

  async calendar(from: string, to: string, user: PublicUser, groupId?: string) {
    const isStaff = user.role === Role.DIRECTOR_GENERAL || user.role === Role.DIRECTOR_ADMINISTRATIVO || user.role === Role.ASISTENTE_DIRECCION;
    const groups = await this.prisma.group.findMany({
      where: { active: true, ...(groupId ? { id: groupId } : {}), ...(isStaff ? {} : { teachers: { some: { userId: user.id } } }) },
      include: { schedules: true, discipline: true },
    });
    const events = [];
    for (const group of groups) {
      const slots = group.schedules.length ? group.schedules : group.dayOfWeek == null ? [] : [{ dayOfWeek: group.dayOfWeek, startTime: group.startTime ?? '', endTime: group.endTime ?? '', location: group.location }];
      for (let cursor = new Date(`${from}T00:00:00Z`); cursor <= new Date(`${to}T00:00:00Z`); cursor = new Date(cursor.getTime() + 86_400_000)) {
        const day = cursor.getUTCDay();
        for (const slot of slots) {
          if (slot.dayOfWeek === day) events.push({ date: cursor.toISOString().slice(0, 10), groupId: group.id, group: group.name, discipline: group.discipline.name, ...slot });
        }
      }
    }
    return events;
  }

  async rosterCsv(groupId: string) {
    const group = await this.prisma.group.findUnique({ where: { id: groupId }, include: { students: { where: { endedAt: null }, include: { student: true } } } });
    if (!group) throw new NotFoundException('Group not found');
    const lines = ['nombre,apellidos,estado', ...group.students.map((item) => `${item.student.firstName},${item.student.lastName},${item.student.enrollmentStatus}`)];
    return lines.join('\n');
  }

  async withdrawStudent(groupId: string, studentId: string) {
    const where = { studentId_groupId: { studentId, groupId } };
    const membership = await this.prisma.studentGroup.findUnique({ where });
    if (!membership || membership.endedAt) throw new NotFoundException('Enrollment not found');
    return this.prisma.studentGroup.update({ where, data: { endedAt: new Date() }, include: { student: true } });
  }

  private async ensureGroup(id: string) {
    const group = await this.prisma.group.findUnique({ where: { id }, include: { discipline: true } });
    if (!group) throw new NotFoundException('Group not found');
    return group;
  }

  private async ensureOperableGroup(id: string) {
    const group = await this.ensureGroup(id);
    if (!group.active) throw new ConflictException('Group is inactive');
    if (!group.discipline.active) throw new ConflictException('Inactive discipline cannot be used');
    return group;
  }

  private async ensureScheduleAvailable(dto: Schedule, disciplineId: string, excludedId?: string) {
    if (dto.dayOfWeek == null || !dto.startTime || !dto.endTime) return;
    if (dto.startTime >= dto.endTime) throw new ConflictException('End time must be after start time');
    const overlap = {
      dayOfWeek: dto.dayOfWeek,
      id: excludedId ? { not: excludedId } : undefined,
      startTime: { lt: dto.endTime },
      endTime: { gt: dto.startTime },
      active: true,
      discipline: { active: true },
    };
    const sameDiscipline = await this.prisma.group.findFirst({ where: { ...overlap, disciplineId } });
    if (sameDiscipline) throw new ConflictException('Another group has a conflicting schedule');
    const location = dto.location?.trim();
    if (location) {
      const room = await this.prisma.group.findFirst({ where: { ...overlap, location: { equals: location, mode: 'insensitive' } } });
      if (room) throw new ConflictException('Location has a conflicting schedule');
    }
    if (!excludedId) return;
    const assigned = await this.prisma.groupTeacher.findMany({ where: { groupId: excludedId }, select: { userId: true } });
    for (const teacher of assigned) await this.ensureTeacherFree(teacher.userId, dto, excludedId);
  }

  private async ensureSlotFree(slot: Schedule, excludedGroupId: string) {
    if (slot.dayOfWeek == null || !slot.startTime || !slot.endTime) return;
    if (slot.startTime >= slot.endTime) throw new ConflictException('End time must be after start time');
    const sameRoom = slot.location?.trim()
      ? await this.prisma.groupSchedule.findFirst({
        where: { groupId: { not: excludedGroupId }, dayOfWeek: slot.dayOfWeek, startTime: { lt: slot.endTime }, endTime: { gt: slot.startTime }, location: { equals: slot.location.trim(), mode: 'insensitive' }, group: { active: true } },
      })
      : null;
    if (sameRoom) throw new ConflictException('Location has a conflicting schedule');
  }

  private async ensureTeacherFree(userId: string, schedule: Schedule, excludedGroupId: string) {
    if (schedule.dayOfWeek == null || !schedule.startTime || !schedule.endTime) return;
    const conflict = await this.prisma.group.findFirst({
      where: {
        active: true,
        discipline: { active: true },
        id: { not: excludedGroupId },
        dayOfWeek: schedule.dayOfWeek,
        startTime: { lt: schedule.endTime },
        endTime: { gt: schedule.startTime },
        teachers: { some: { userId } },
      },
    });
    if (conflict) throw new ConflictException('Teacher has a conflicting schedule');
  }
}
