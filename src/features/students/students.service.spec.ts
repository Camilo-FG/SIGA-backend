import { BadRequestException } from '@nestjs/common';
import { EnrollmentStatus, Role } from '../../generated/prisma/client.js';
import type { PublicUser } from '../../users/users.service.js';
import { StudentsService } from './students.service.js';

const assistant = { id: 'assistant-1', role: Role.ASISTENTE_DIRECCION } as PublicUser;

describe('StudentsService', () => {
  it('requires a guardian for a student under 18', async () => {
    const create = vi.fn();
    const service = new StudentsService({ student: { create } } as never, { log: async () => undefined } as never, {} as never);
    await expect(service.create({ firstName: 'Ana', lastName: 'Solis', birthDate: '2020-01-01' })).rejects.toBeInstanceOf(BadRequestException);
    expect(create).not.toHaveBeenCalled();
  });

  it('closes active enrollments when a student is deactivated', async () => {
    const updateMany = vi.fn();
    const update = vi.fn(() => ({ id: 'student-1', enrollmentStatus: EnrollmentStatus.INACTIVE }));
    const service = new StudentsService({
      student: { findUnique: () => ({ id: 'student-1' }), update },
      $transaction: async (work: (tx: { studentGroup: { updateMany: typeof updateMany }; student: { update: typeof update } }) => Promise<unknown>) => work({ studentGroup: { updateMany }, student: { update } }),
    } as never, { log: async () => undefined } as never, {} as never);

    await service.deactivate('student-1', assistant);

    expect(updateMany).toHaveBeenCalledWith({ where: { studentId: 'student-1', endedAt: null }, data: { endedAt: expect.any(Date) as Date } });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: { enrollmentStatus: EnrollmentStatus.INACTIVE } }));
  });
});
