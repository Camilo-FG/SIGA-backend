import { ConflictException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import type { User } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { pageResult, pageWindow } from '../common/page.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { Role } from '../generated/prisma/client.js';

export const BCRYPT_ROUNDS = 10;

const roleRank: Record<Role, number> = {
  [Role.DIRECTOR_GENERAL]: 4,
  [Role.DIRECTOR_ADMINISTRATIVO]: 3,
  [Role.ASISTENTE_DIRECCION]: 2,
  [Role.COREOGRAFO]: 1,
  [Role.PROFESOR]: 1,
};

/** A user as exposed by the API: never includes the password hash. */
export type PublicUser = Omit<User, 'password'>;

const publicSelect = { id: true, email: true, name: true, role: true, active: true, createdAt: true, updatedAt: true } as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  static toPublic(user: User): PublicUser {
    const { password: _password, ...publicUser } = user;
    void _password;
    return publicUser;
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async create(dto: CreateUserDto, actor: PublicUser): Promise<PublicUser> {
    const role = this.sameTeachingRole(dto.role ?? Role.COREOGRAFO);
    this.assertRoleAllowed(actor, role);

    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });

    if (existing) {
      throw new ConflictException('Email is already registered');
    }

    const password = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.prisma.user.create({
      data: { email, password, name: dto.name.trim(), role },
    });

    return UsersService.toPublic(user);
  }

  async listInternal(role?: Role, active?: boolean, page = 1, limit = 20) {
    const window = pageWindow(page, limit);
    const where = { ...(role ? { role } : {}), ...(active === undefined ? {} : { active }) };
    const [data, total] = await Promise.all([
      this.prisma.user.findMany({ where, orderBy: { name: 'asc' }, select: publicSelect, skip: window.skip, take: window.limit }),
      this.prisma.user.count({ where }),
    ]);
    return pageResult(data, total, window.page, window.limit);
  }

  async changePassword(userId: string, currentPassword: string, nextPassword: string) {
    const user = await this.findById(userId);
    if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
      throw new UnauthorizedException('La contraseña actual no es correcta');
    }
    await this.prisma.user.update({ where: { id: userId }, data: { password: await bcrypt.hash(nextPassword, BCRYPT_ROUNDS) } });
  }

  async update(actor: PublicUser, id: string, input: { name?: string; email?: string; role?: Role }) {
    const target = await this.requireUser(id);
    const role = input.role ? this.sameTeachingRole(input.role) : undefined;
    if (role) {
      this.assertRoleAllowed(actor, role);
      await this.assertLastDirector(target, role, target.active);
    }
    const email = input.email?.trim().toLowerCase();
    if (email && email !== target.email) {
      const existing = await this.prisma.user.findUnique({ where: { email } });
      if (existing) throw new ConflictException('Ese correo ya está registrado.');
    }
    const user = await this.prisma.user.update({
      where: { id },
      data: { ...(input.name ? { name: input.name.trim() } : {}), ...(email ? { email } : {}), ...(role ? { role } : {}) },
    });
    if (role && role !== target.role) {
      await this.audit.log(actor.id, 'CAMBIAR_ROL', 'Usuario', id, { from: target.role, to: role });
    }
    if (email && email !== target.email) {
      await this.audit.log(actor.id, 'CAMBIAR_CORREO', 'Usuario', id, { from: target.email, to: email });
    }
    return UsersService.toPublic(user);
  }

  async setActive(actor: PublicUser, id: string, active: boolean) {
    const target = await this.requireUser(id);
    await this.assertLastDirector(target, target.role, active);
    const user = await this.prisma.user.update({ where: { id }, data: { active } });
    return UsersService.toPublic(user);
  }

  async resetPassword(actor: PublicUser, id: string) {
    await this.requireUser(id);
    const temporaryPassword = `${randomBytes(9).toString('base64url')}aA1`;
    await this.prisma.user.update({ where: { id }, data: { password: await bcrypt.hash(temporaryPassword, BCRYPT_ROUNDS) } });
    await this.audit.log(actor.id, 'RESTABLECER_CONTRASENA', 'Usuario', id);
    return { temporaryPassword };
  }

  private sameTeachingRole(role: Role) {
    return role === Role.PROFESOR ? Role.COREOGRAFO : role;
  }

  private assertRoleAllowed(actor: PublicUser, role: Role) {
    if (roleRank[role] > roleRank[actor.role]) throw new ForbiddenException('Role exceeds the operator');
  }

  private async assertLastDirector(target: User, nextRole: Role, nextActive: boolean) {
    const losesDirection = target.role === Role.DIRECTOR_GENERAL && target.active && (nextRole !== Role.DIRECTOR_GENERAL || !nextActive);
    if (!losesDirection) return;
    const directors = await this.prisma.user.count({ where: { role: Role.DIRECTOR_GENERAL, active: true } });
    if (directors <= 1) throw new ForbiddenException('No se puede degradar ni desactivar al último director general');
  }

  private async requireUser(id: string) {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user;
  }
}
