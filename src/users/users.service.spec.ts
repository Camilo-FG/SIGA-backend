import { ForbiddenException } from '@nestjs/common';
import { Role } from '../generated/prisma/client.js';
import type { PublicUser } from './users.service.js';
import { UsersService } from './users.service.js';

const director = { id: 'director-1', role: Role.DIRECTOR_GENERAL } as PublicUser;
const administrator = { id: 'admin-1', role: Role.DIRECTOR_ADMINISTRATIVO } as PublicUser;

describe('UsersService.create', () => {
  it('rejects a role above the operator', async () => {
    const create = vi.fn();
    const service = new UsersService({ user: { findUnique: async () => null, create } } as never);

    await expect(service.create({ email: 'ana@adagio.test', password: 'supersecret', name: 'Ana', role: Role.DIRECTOR_GENERAL }, administrator)).rejects.toBeInstanceOf(ForbiddenException);
    expect(create).not.toHaveBeenCalled();
  });

  it('stores a role that does not exceed the operator and omits the password', async () => {
    const create = vi.fn(async ({ data }: { data: { email: string; password: string; name: string; role: Role } }) => ({
      id: 'user-1',
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    const service = new UsersService({ user: { findUnique: async () => null, create } } as never);

    const user = await service.create({ email: 'ana@adagio.test', password: 'supersecret', name: 'Ana', role: Role.ASISTENTE_DIRECCION }, director);

    expect(user.role).toBe(Role.ASISTENTE_DIRECCION);
    expect(user).not.toHaveProperty('password');
  });
});
