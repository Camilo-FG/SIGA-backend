import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { createReadStream } from 'node:fs';
import { EnrollmentStatus, Role } from '../../generated/prisma/client.js';
import { AuditService } from '../../audit/audit.service.js';
import { ageInYears, isMinor } from '../../common/age.js';
import { pageResult, pageWindow } from '../../common/page.js';
import { FilesService, type UploadedFile } from '../../files/files.service.js';
import type { PublicUser } from '../../users/users.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { CreateStudentDto } from './dto/create-student.dto.js';
import type { UpdateStudentDto } from './dto/update-student.dto.js';

const staffRoles = new Set<Role>([Role.DIRECTOR_GENERAL, Role.DIRECTOR_ADMINISTRATIVO, Role.ASISTENTE_DIRECCION]);

const studentInclude = {
  guardians: { include: { guardian: true } },
} as const;

@Injectable()
export class StudentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly files: FilesService,
  ) {}

  async list(user: PublicUser, query: { search?: string; status?: EnrollmentStatus; groupId?: string; disciplineId?: string; page?: number; limit?: number }) {
    const window = pageWindow(query.page, query.limit);
    const term = query.search?.trim();
    const ownGroups = staffRoles.has(user.role) ? {} : { teachers: { some: { userId: user.id } } };
    const where = {
      ...(query.status ? { enrollmentStatus: query.status } : {}),
      ...(term ? { OR: [
        { firstName: { contains: term, mode: 'insensitive' as const } },
        { lastName: { contains: term, mode: 'insensitive' as const } },
        { email: { contains: term, mode: 'insensitive' as const } },
        { nationalId: { contains: term, mode: 'insensitive' as const } },
      ] } : {}),
      ...((query.groupId || query.disciplineId || !staffRoles.has(user.role)) ? {
        groups: { some: { endedAt: null, group: { ...ownGroups, ...(query.groupId ? { id: query.groupId } : {}), ...(query.disciplineId ? { disciplineId: query.disciplineId } : {}) } } },
      } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.student.findMany({ where, include: studentInclude, orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }], skip: window.skip, take: window.limit }),
      this.prisma.student.count({ where }),
    ]);
    return pageResult(rows.map((student) => this.present(student, user)), total, window.page, window.limit);
  }

  async findById(id: string, user: PublicUser) {
    const since = new Date(Date.now() - 30 * 86_400_000);
    const student = await this.prisma.student.findUnique({
      where: { id },
      include: {
        ...studentInclude,
        groups: { where: { endedAt: null }, include: { group: { include: { discipline: true, schedules: true, teachers: true } } } },
        attendanceRecords: { where: { session: { date: { gte: since }, cancelled: false } }, include: { session: true } },
        charges: { where: { status: { not: 'CANCELADO' } }, include: { payments: true } },
      },
    });
    if (!student) throw new NotFoundException('Student not found');
    this.assertCanSee(student.groups.map((item) => item.group), user);
    const visibleGroups = staffRoles.has(user.role) ? student.groups : student.groups.filter((item) => item.group.teachers.some((teacher) => teacher.userId === user.id));
    const marks = student.attendanceRecords.filter((record) => visibleGroups.some((item) => item.groupId === record.session.groupId) || staffRoles.has(user.role));
    const counted = marks.filter((record) => record.status !== 'JUSTIFICADA');
    const attended = counted.filter((record) => record.status === 'PRESENTE' || record.status === 'TARDIA').length;
    const balance = staffRoles.has(user.role) ? student.charges.reduce((sum, charge) => sum + this.chargeBalance(charge), 0) : undefined;
    return {
      ...this.present(student, user),
      age: student.birthDate ? ageInYears(student.birthDate) : null,
      groups: visibleGroups.map((item) => ({ ...item, group: { ...item.group, teachers: undefined } })),
      attendanceRate30Days: counted.length ? Math.round((attended / counted.length) * 100) : 0,
      ...(balance === undefined ? {} : { balance }),
    };
  }

  async create(dto: CreateStudentDto) {
    const birthDate = dto.birthDate ? new Date(dto.birthDate) : undefined;
    if (isMinor(birthDate) && !(dto.guardians?.length)) throw new BadRequestException('Un menor de 18 años debe tener al menos un encargado');
    try {
      return await this.prisma.student.create({
        data: {
          ...this.studentData(dto),
          ...(dto.guardians?.length ? { guardians: { create: dto.guardians.map((guardian) => ({ guardianId: guardian.guardianId, relationship: guardian.relationship.trim(), isPaymentResponsible: guardian.isPaymentResponsible ?? false })) } } : {}),
        },
        include: studentInclude,
      });
    } catch {
      throw new ConflictException('La cédula ya está registrada');
    }
  }

  async update(id: string, dto: UpdateStudentDto) {
    const current = await this.prisma.student.findUnique({ where: { id }, include: { guardians: true } });
    if (!current) throw new NotFoundException('Student not found');
    const birthDate = dto.birthDate ? new Date(dto.birthDate) : current.birthDate;
    if (isMinor(birthDate) && current.guardians.length === 0 && !(dto.guardians?.length)) {
      throw new BadRequestException('Un menor de 18 años debe tener al menos un encargado');
    }
    try {
      return await this.prisma.student.update({
        where: { id },
        data: {
          ...this.studentData(dto),
          ...(dto.guardians?.length ? { guardians: { create: dto.guardians.map((guardian) => ({ guardianId: guardian.guardianId, relationship: guardian.relationship.trim(), isPaymentResponsible: guardian.isPaymentResponsible ?? false })) } } : {}),
        },
        include: studentInclude,
      });
    } catch {
      throw new ConflictException('La cédula ya está registrada');
    }
  }

  async deactivate(id: string, actor: PublicUser) {
    const current = await this.prisma.student.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Student not found');
    const student = await this.prisma.$transaction(async (tx) => {
      await tx.studentGroup.updateMany({ where: { studentId: id, endedAt: null }, data: { endedAt: new Date() } });
      return tx.student.update({ where: { id }, data: { enrollmentStatus: EnrollmentStatus.INACTIVE }, include: studentInclude });
    });
    await this.audit.log(actor.id, 'BAJA_ESTUDIANTE', 'Estudiante', id);
    return student;
  }

  async savePhoto(id: string, file: UploadedFile) {
    await this.ensureExists(id);
    const photoPath = await this.files.save('photos', file, ['image/jpeg', 'image/png'], 2 * 1024 * 1024);
    return this.prisma.student.update({ where: { id }, data: { photoPath }, include: studentInclude });
  }

  async openPhoto(id: string, user: PublicUser) {
    const student = await this.prisma.student.findUnique({ where: { id }, include: { groups: { where: { endedAt: null }, include: { group: { include: { teachers: true } } } } } });
    if (!student?.photoPath) throw new NotFoundException('Foto no encontrada');
    this.assertCanSee(student.groups.map((item) => item.group), user);
    return createReadStream(this.files.absolute(student.photoPath));
  }

  private present<T extends { guardians?: unknown; charges?: unknown }>(student: T, user: PublicUser) {
    if (staffRoles.has(user.role)) return student;
    const { guardians: _guardians, charges: _charges, ...safe } = student;
    void _guardians;
    void _charges;
    return safe;
  }

  private assertCanSee(groups: { teachers: { userId: string }[] }[], user: PublicUser) {
    if (staffRoles.has(user.role)) return;
    if (!groups.some((group) => group.teachers.some((teacher) => teacher.userId === user.id))) {
      throw new ForbiddenException('No tienes acceso a este estudiante');
    }
  }

  private chargeBalance(charge: { amount: { toString(): string } | number; payments: { amount: { toString(): string } | number; receiptStatus: string }[] }) {
    const paid = charge.payments.filter((payment) => payment.receiptStatus === 'APROBADO').reduce((sum, payment) => sum + Number(payment.amount), 0);
    return Math.max(0, Number(charge.amount) - paid);
  }

  private async ensureExists(id: string) {
    const student = await this.prisma.student.findUnique({ where: { id } });
    if (!student) throw new NotFoundException('Student not found');
    return student;
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
      nationalId: dto.nationalId?.trim() || undefined,
      notes: dto.notes?.trim(),
    };
  }
}
