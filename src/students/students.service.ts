import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateGuardianDto } from './dto/create-guardian.dto.js';
import type { CreateStudentDto } from './dto/create-student.dto.js';
import type { UpdateStudentDto } from './dto/update-student.dto.js';
import type { UpdateGuardianDto } from './dto/update-guardian.dto.js';

const studentInclude = {
  guardians: { include: { guardian: true } },
} as const;

@Injectable()
export class StudentsService {
  constructor(private readonly prisma: PrismaService) {}

  list(search?: string, status?: CreateStudentDto['enrollmentStatus']) {
    const term = search?.trim();
    return this.prisma.student.findMany({
      where: {
        ...(status ? { enrollmentStatus: status } : {}),
        ...(term ? {
          OR: [
            { firstName: { contains: term, mode: 'insensitive' } },
            { lastName: { contains: term, mode: 'insensitive' } },
            { email: { contains: term, mode: 'insensitive' } },
          ],
        } : {}),
      },
      include: studentInclude,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
  }

  async findById(id: string) {
    const student = await this.prisma.student.findUnique({ where: { id }, include: studentInclude });
    if (!student) throw new NotFoundException('Student not found');
    return student;
  }

  create(dto: CreateStudentDto) {
    return this.prisma.student.create({
      data: this.studentData(dto),
      include: studentInclude,
    });
  }

  async update(id: string, dto: UpdateStudentDto) {
    await this.findById(id);
    return this.prisma.student.update({ where: { id }, data: this.studentData(dto), include: studentInclude });
  }

  async deactivate(id: string) {
    await this.findById(id);
    return this.prisma.student.update({
      where: { id },
      data: { enrollmentStatus: 'INACTIVE' },
      include: studentInclude,
    });
  }

  createGuardian(dto: CreateGuardianDto) {
    return this.prisma.guardian.create({ data: this.guardianData(dto) });
  }

  listGuardians() {
    return this.prisma.guardian.findMany({ include: { students: { include: { student: true } } }, orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }] });
  }

  async findGuardian(id: string) {
    const guardian = await this.prisma.guardian.findUnique({ where: { id }, include: { students: { include: { student: true } } } });
    if (!guardian) throw new NotFoundException('Guardian not found');
    return guardian;
  }

  async updateGuardian(id: string, dto: UpdateGuardianDto) {
    await this.findGuardian(id);
    return this.prisma.guardian.update({ where: { id }, data: this.guardianData(dto), include: { students: { include: { student: true } } } });
  }

  async linkGuardian(studentId: string, guardianId: string, relationship: string) {
    await this.findById(studentId);
    const guardian = await this.prisma.guardian.findUnique({ where: { id: guardianId } });
    if (!guardian) throw new NotFoundException('Guardian not found');
    return this.prisma.studentGuardian.upsert({
      where: { studentId_guardianId: { studentId, guardianId } },
      create: { studentId, guardianId, relationship: relationship.trim() },
      update: { relationship: relationship.trim() },
      include: { guardian: true },
    });
  }

  async unlinkGuardian(studentId: string, guardianId: string) {
    await this.findById(studentId);
    await this.findGuardian(guardianId);
    await this.prisma.studentGuardian.delete({ where: { studentId_guardianId: { studentId, guardianId } } }).catch(() => { throw new NotFoundException('Guardian relationship not found'); });
    return { success: true };
  }

  private studentData(dto: CreateStudentDto) {
    return {
      firstName: dto.firstName.trim(),
      lastName: dto.lastName.trim(),
      birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
      email: dto.email?.trim().toLowerCase(),
      phone: dto.phone?.trim(),
      enrollmentStatus: dto.enrollmentStatus,
      emergencyContactName: dto.emergencyContactName?.trim(),
      emergencyContactPhone: dto.emergencyContactPhone?.trim(),
    };
  }

  private guardianData(dto: CreateGuardianDto) {
    return { firstName: dto.firstName.trim(), lastName: dto.lastName.trim(), email: dto.email?.trim().toLowerCase(), phone: dto.phone?.trim() };
  }
}
