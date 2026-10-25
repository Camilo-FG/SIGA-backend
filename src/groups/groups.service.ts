import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateDisciplineDto } from './dto/create-discipline.dto.js';
import type { CreateGroupDto } from './dto/create-group.dto.js';

const groupInclude = { discipline: true, teachers: { include: { user: { select: { id: true, name: true, email: true, role: true } } } }, students: { include: { student: true } } } as const;

@Injectable()
export class GroupsService {
  constructor(private readonly prisma: PrismaService) {}

  listDisciplines() { return this.prisma.discipline.findMany({ where: { active: true }, orderBy: { name: 'asc' } }); }

  async createDiscipline(dto: CreateDisciplineDto) {
    try { return await this.prisma.discipline.create({ data: { name: dto.name.trim() } }); }
    catch { throw new ConflictException('Discipline already exists'); }
  }

  listGroups() { return this.prisma.group.findMany({ where: { active: true }, include: groupInclude, orderBy: { name: 'asc' } }); }

  async createGroup(dto: CreateGroupDto) {
    const discipline = await this.prisma.discipline.findUnique({ where: { id: dto.disciplineId } });
    if (!discipline) throw new NotFoundException('Discipline not found');
    try { return await this.prisma.group.create({ data: { ...dto, name: dto.name.trim(), location: dto.location?.trim() }, include: groupInclude }); }
    catch { throw new ConflictException('Group already exists for this discipline'); }
  }

  async assignTeacher(groupId: string, userId: string) {
    await this.ensureGroup(groupId);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || (user.role !== Role.PROFESOR && user.role !== Role.COREOGRAFO)) throw new NotFoundException('Assigned teacher not found or invalid role');
    return this.prisma.groupTeacher.upsert({ where: { groupId_userId: { groupId, userId } }, create: { groupId, userId }, update: {}, include: { user: true } });
  }

  async assignStudent(groupId: string, studentId: string) {
    await this.ensureGroup(groupId);
    const student = await this.prisma.student.findUnique({ where: { id: studentId } });
    if (!student) throw new NotFoundException('Student not found');
    return this.prisma.studentGroup.upsert({ where: { studentId_groupId: { studentId, groupId } }, create: { studentId, groupId }, update: {}, include: { student: true } });
  }

  private async ensureGroup(id: string) {
    const group = await this.prisma.group.findUnique({ where: { id } });
    if (!group) throw new NotFoundException('Group not found');
    return group;
  }
}
