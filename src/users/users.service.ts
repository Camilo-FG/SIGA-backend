import { ConflictException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import type { User } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { Role } from '../generated/prisma/client.js';

export const BCRYPT_ROUNDS = 10;

/** A user as exposed by the API: never includes the password hash. */
export type PublicUser = Omit<User, 'password'>;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

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

  async create(dto: CreateUserDto): Promise<PublicUser> {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });

    if (existing) {
      throw new ConflictException('Email is already registered');
    }

    const password = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.prisma.user.create({
      data: { email, password, name: dto.name.trim() },
    });

    return UsersService.toPublic(user);
  }

  listInternal(role?: Role): Promise<PublicUser[]> {
    return this.prisma.user.findMany({ where: role ? { role } : undefined, orderBy: { name: 'asc' }, select: { id: true, email: true, name: true, role: true, createdAt: true, updatedAt: true } });
  }
}
