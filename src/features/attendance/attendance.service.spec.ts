import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AttendanceStatus, Role } from '../../generated/prisma/client.js';
import type { PublicUser } from '../../users/users.service.js';
import { AttendanceService } from './attendance.service.js';

const teacher = { id: 'teacher-1', role: Role.PROFESOR } as PublicUser;
const record = { groupId: 'group-1', date: '2026-10-25', records: [{ studentId: 'student-1', status: AttendanceStatus.PRESENTE }] };
const enrolled = { studentId: 'student-1', startedAt: new Date('2020-01-01T00:00:00.000Z'), endedAt: null };

describe('AttendanceService.record', () => {
  it('rejects a teacher who is not assigned to the group', async () => {
    const upsert = vi.fn();
    const prisma = {
      group: { findUnique: async () => ({ id: 'group-1', teachers: [{ userId: 'other-teacher' }], students: [enrolled] }) },
      attendanceSession: { upsert },
    };
    const service = new AttendanceService(prisma as never);

    await expect(service.record(record, teacher)).rejects.toBeInstanceOf(ForbiddenException);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('saves attendance when the teacher is assigned to the group', async () => {
    const upsert = vi.fn(async () => ({ id: 'session-1' }));
    const prisma = {
      group: { findUnique: async () => ({ id: 'group-1', teachers: [{ userId: teacher.id }], students: [enrolled] }) },
      attendanceSession: { upsert },
    };
    const service = new AttendanceService(prisma as never);

    await service.record(record, teacher);
    expect(upsert).toHaveBeenCalledOnce();
  });

  it('rejects a student whose enrollment does not cover the class date', async () => {
    const upsert = vi.fn();
    const prisma = {
      group: { findUnique: async () => ({ id: 'group-1', teachers: [{ userId: teacher.id }], students: [{ studentId: 'student-1', startedAt: new Date('2020-01-01T00:00:00.000Z'), endedAt: new Date('2026-10-24T12:00:00.000Z') }] }) },
      attendanceSession: { upsert },
    };
    const service = new AttendanceService(prisma as never);

    await expect(service.record(record, teacher)).rejects.toBeInstanceOf(BadRequestException);
    expect(upsert).not.toHaveBeenCalled();
  });
});
