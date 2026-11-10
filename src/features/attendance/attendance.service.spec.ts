import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AttendanceStatus, Role } from '../../generated/prisma/client.js';
import type { PublicUser } from '../../users/users.service.js';
import { attendanceRate, AttendanceService } from './attendance.service.js';

const teacher = { id: 'teacher-1', role: Role.PROFESOR } as PublicUser;
const record = { groupId: 'group-1', date: new Date().toISOString().slice(0, 10), records: [{ studentId: 'student-1', status: AttendanceStatus.PRESENTE }] };
const enrolled = { studentId: 'student-1', startedAt: new Date('2020-01-01T00:00:00.000Z'), endedAt: null };

describe('AttendanceService.record', () => {
  it('rejects a teacher who is not assigned to the group', async () => {
    const upsert = vi.fn();
    const prisma = {
      group: { findUnique: () => ({ id: 'group-1', teachers: [{ userId: 'other-teacher' }], students: [enrolled] }) },
      attendanceSession: { upsert, findUnique: () => null },
    };
    const service = new AttendanceService(prisma as never, { log: async () => undefined } as never);

    await expect(service.record(record, teacher)).rejects.toBeInstanceOf(ForbiddenException);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('saves attendance when the teacher is assigned to the group', async () => {
    const upsert = vi.fn(() => ({ id: 'session-1' }));
    const prisma = {
      group: { findUnique: () => ({ id: 'group-1', teachers: [{ userId: teacher.id }], students: [enrolled] }) },
      attendanceSession: { upsert, findUnique: () => null },
    };
    const service = new AttendanceService(prisma as never, { log: async () => undefined } as never);

    await service.record(record, teacher);
    expect(upsert).toHaveBeenCalledOnce();
  });

  it('rejects a student whose enrollment does not cover the class date', async () => {
    const upsert = vi.fn();
    const prisma = {
      group: { findUnique: () => ({ id: 'group-1', teachers: [{ userId: teacher.id }], students: [{ studentId: 'student-1', startedAt: new Date('2020-01-01T00:00:00.000Z'), endedAt: new Date('2026-10-24T12:00:00.000Z') }] }) },
      attendanceSession: { upsert, findUnique: () => null },
    };
    const service = new AttendanceService(prisma as never, { log: async () => undefined } as never);

    await expect(service.record(record, teacher)).rejects.toBeInstanceOf(BadRequestException);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('rejects a future class date', async () => {
    const service = new AttendanceService({ attendanceSession: { findUnique: () => null }, group: { findUnique: vi.fn() } } as never, { log: async () => undefined } as never);
    await expect(service.record({ ...record, date: '2999-01-01' }, teacher)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('counts late as present and leaves justified marks out of the rate', () => {
    expect(attendanceRate([
      { status: AttendanceStatus.PRESENTE },
      { status: AttendanceStatus.TARDIA },
      { status: AttendanceStatus.AUSENTE },
      { status: AttendanceStatus.JUSTIFICADA },
    ])).toBe(67);
  });
});
