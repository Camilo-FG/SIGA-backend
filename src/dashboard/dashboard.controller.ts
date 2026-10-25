import { Controller, Get } from '@nestjs/common';
import { Role } from '../generated/prisma/client.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import type { PublicUser } from '../users/users.service.js';
import { DashboardService } from './dashboard.service.js';

@Controller('dashboard')
@Roles(Role.DIRECTOR_GENERAL, Role.DIRECTOR_ADMINISTRATIVO, Role.ASISTENTE_DIRECCION, Role.COREOGRAFO, Role.PROFESOR)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}
  @Get('summary') summary(@CurrentUser() user: PublicUser) { return this.dashboardService.summary(user); }
}
