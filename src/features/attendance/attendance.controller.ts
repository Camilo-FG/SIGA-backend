import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Role } from '../../generated/prisma/client.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import type { PublicUser } from '../../users/users.service.js';
import { AttendanceService } from './attendance.service.js';
import { RecordAttendanceDto } from './dto/record-attendance.dto.js';
import { ListAttendanceQueryDto } from './dto/list-attendance-query.dto.js';
import { RosterQueryDto } from './dto/roster-query.dto.js';

@Controller('attendance')
@Roles(Role.DIRECTOR_GENERAL, Role.DIRECTOR_ADMINISTRATIVO, Role.ASISTENTE_DIRECCION, Role.COREOGRAFO, Role.PROFESOR)
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Get('today')
  @Roles(Role.COREOGRAFO, Role.PROFESOR, Role.DIRECTOR_ADMINISTRATIVO)
  today(@CurrentUser() user: PublicUser) { return this.attendanceService.today(user); }

  @Get('alerts')
  @Roles(Role.DIRECTOR_GENERAL, Role.DIRECTOR_ADMINISTRATIVO, Role.ASISTENTE_DIRECCION)
  alerts(@Query('threshold') threshold?: string) { return this.attendanceService.alerts(threshold ? Number(threshold) : 75); }

  @Patch('sessions/:id/cancel')
  cancel(@Param('id') id: string, @CurrentUser() user: PublicUser) { return this.attendanceService.cancel(id, user); }

  @Get('roster')
  roster(@Query() query: RosterQueryDto, @CurrentUser() user: PublicUser) { return this.attendanceService.roster(query.groupId, query.date, user); }

  @Get()
  list(@Query() query: ListAttendanceQueryDto, @CurrentUser() user: PublicUser) { return this.attendanceService.list(query, user); }

  @Post()
  record(@Body() dto: RecordAttendanceDto, @CurrentUser() user: PublicUser) { return this.attendanceService.record(dto, user); }
}
