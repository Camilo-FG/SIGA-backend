import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { CreateGuardianDto } from './dto/create-guardian.dto.js';
import type { UpdateGuardianDto } from './dto/update-guardian.dto.js';

@Injectable()
export class GuardiansService {
  constructor(private readonly prisma: PrismaService) {}
  private data(dto: CreateGuardianDto) { return { firstName: dto.firstName.trim(), lastName: dto.lastName.trim(), email: dto.email?.trim().toLowerCase(), phone: dto.phone?.trim() }; }
  create(dto: CreateGuardianDto) { return this.prisma.guardian.create({ data: this.data(dto) }); }
  list() { return this.prisma.guardian.findMany({ include: { students: { include: { student: true } } }, orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }] }); }
  async find(id: string) { const guardian = await this.prisma.guardian.findUnique({ where: { id }, include: { students: { include: { student: true } } } }); if (!guardian) throw new NotFoundException('Guardian not found'); return guardian; }
  async update(id: string, dto: UpdateGuardianDto) { await this.find(id); return this.prisma.guardian.update({ where: { id }, data: this.data(dto), include: { students: { include: { student: true } } } }); }
  async link(studentId: string, guardianId: string, relationship: string) {
    const student = await this.prisma.student.findUnique({ where: { id: studentId } }); if (!student) throw new NotFoundException('Student not found');
    await this.find(guardianId);
    return this.prisma.studentGuardian.upsert({ where: { studentId_guardianId: { studentId, guardianId } }, create: { studentId, guardianId, relationship: relationship.trim() }, update: { relationship: relationship.trim() }, include: { guardian: true, student: true } });
  }
  async unlink(studentId: string, guardianId: string) { await this.find(guardianId); try { await this.prisma.studentGuardian.delete({ where: { studentId_guardianId: { studentId, guardianId } } }); } catch { throw new NotFoundException('Guardian relationship not found'); } return { success: true }; }
}
