import { ConflictException } from '@nestjs/common';
import { EnrollmentStatus, Role } from '../../generated/prisma/client.js';
import { GroupsService } from './groups.service.js';

describe('GroupsService', () => {
  it('deactivates a group and keeps the row', async () => {
    const update = vi.fn(async () => ({ id: 'group-1', active: false }));
    const service = new GroupsService({
      group: { findUnique: async () => ({ id: 'group-1', active: true, discipline: { active: true } }), update },
    } as never);

    await service.deactivateGroup('group-1');

    expect(update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'group-1' }, data: { active: false } }));
  });

  it('rejects an inactive student', async () => {
    const create = vi.fn();
    const service = new GroupsService({
      group: { findUnique: async () => ({ id: 'group-1', active: true, discipline: { active: true } }) },
      student: { findUnique: async () => ({ id: 'student-1', enrollmentStatus: EnrollmentStatus.INACTIVE }) },
      studentGroup: { create },
    } as never);

    await expect(service.assignStudent('group-1', 'student-1')).rejects.toBeInstanceOf(ConflictException);
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects a group on an inactive discipline', async () => {
    const create = vi.fn();
    const service = new GroupsService({
      discipline: { findUnique: async () => ({ id: 'discipline-1', active: false }) },
      group: { create },
    } as never);

    await expect(service.createGroup({ name: 'Inicial', disciplineId: 'discipline-1' })).rejects.toThrow('Inactive discipline cannot be used');
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects a schedule that ends before it starts', async () => {
    const create = vi.fn();
    const service = new GroupsService({
      discipline: { findUnique: async () => ({ id: 'discipline-1', active: true }) },
      group: { create, findFirst: vi.fn() },
    } as never);

    await expect(service.createGroup({ name: 'Inicial', disciplineId: 'discipline-1', dayOfWeek: 1, startTime: '18:00', endTime: '17:00' })).rejects.toThrow('End time must be after start time');
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects a room that is already in use at that time', async () => {
    const create = vi.fn();
    const findFirst = vi.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'other-group' });
    const service = new GroupsService({
      discipline: { findUnique: async () => ({ id: 'discipline-1', active: true }) },
      group: { create, findFirst },
    } as never);

    await expect(service.createGroup({ name: 'Inicial', disciplineId: 'discipline-1', dayOfWeek: 1, startTime: '16:00', endTime: '17:00', location: 'Sala 1' })).rejects.toThrow('Location has a conflicting schedule');
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects a teacher who already has a class at that time', async () => {
    const upsert = vi.fn();
    const service = new GroupsService({
      group: {
        findUnique: async () => ({ id: 'group-1', active: true, dayOfWeek: 1, startTime: '16:00', endTime: '17:00', discipline: { active: true } }),
        findFirst: async () => ({ id: 'other-group' }),
      },
      user: { findUnique: async () => ({ id: 'teacher-1', role: Role.PROFESOR }) },
      groupTeacher: { upsert },
    } as never);

    await expect(service.assignTeacher('group-1', 'teacher-1')).rejects.toThrow('Teacher has a conflicting schedule');
    expect(upsert).not.toHaveBeenCalled();
  });

  it('withdraws a student without deleting the enrollment', async () => {
    const update = vi.fn(async () => ({ studentId: 'student-1' }));
    const remove = vi.fn();
    const service = new GroupsService({
      studentGroup: {
        findUnique: async () => ({ studentId: 'student-1', groupId: 'group-1', endedAt: null }),
        update,
        delete: remove,
      },
    } as never);

    await service.withdrawStudent('group-1', 'student-1');

    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ endedAt: expect.any(Date) }) }));
    expect(remove).not.toHaveBeenCalled();
  });
});
