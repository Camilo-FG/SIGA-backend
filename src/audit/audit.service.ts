import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  log(userId: string, action: string, entity: string, entityId: string, detail?: Prisma.InputJsonValue) {
    return this.prisma.auditLog.create({ data: { userId, action, entity, entityId, detail } });
  }
}
