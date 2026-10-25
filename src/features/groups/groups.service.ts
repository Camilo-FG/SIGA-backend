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
