import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { Role } from '../../generated/prisma/client.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import type { PublicUser } from '../../users/users.service.js';
import { AttendanceService } from './attendance.service.js';
import { RecordAttendanceDto } from './dto/record-attendance.dto.js';
import { ListAttendanceQueryDto } from './dto/list-attendance-query.dto.js';

@Controller('attendance')
@Roles(Role.DIRECTOR_GENERAL, Role.DIRECTOR_ADMINISTRATIVO, Role.ASISTENTE_DIRECCION, Role.COREOGRAFO, Role.PROFESOR)
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Get()
  list(@Query() query: ListAttendanceQueryDto, @CurrentUser() user: PublicUser) { return this.attendanceService.list(query, user); }

  @Post()
  record(@Body() dto: RecordAttendanceDto, @CurrentUser() user: PublicUser) { return this.attendanceService.record(dto, user); }
}
