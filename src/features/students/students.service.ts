import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { CreateStudentDto } from './dto/create-student.dto.js';
import type { UpdateStudentDto } from './dto/update-student.dto.js';

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

}
