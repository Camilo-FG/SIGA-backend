import { Body, Controller, Delete, Get, Header, Param, Patch, Post, Query } from '@nestjs/common';
import { Role } from '../../generated/prisma/client.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import type { PublicUser } from '../../users/users.service.js';
import { CreateDisciplineDto } from './dto/create-discipline.dto.js';
import { CreateGroupDto } from './dto/create-group.dto.js';
import { AssignStudentDto } from './dto/assign-student.dto.js';
import { AssignTeacherDto } from './dto/assign-teacher.dto.js';
import { UpdateGroupDto } from './dto/update-group.dto.js';
import { GroupsService } from './groups.service.js';

@Controller()
@Roles(Role.DIRECTOR_GENERAL, Role.DIRECTOR_ADMINISTRATIVO, Role.ASISTENTE_DIRECCION)
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Get('disciplines') listDisciplines() { return this.groupsService.listDisciplines(); }
  @Post('disciplines') createDiscipline(@Body() dto: CreateDisciplineDto) { return this.groupsService.createDiscipline(dto); }
  @Delete('disciplines/:id') deactivateDiscipline(@Param('id') id: string) { return this.groupsService.deactivateDiscipline(id); }
  @Get('groups')
  @Roles(Role.DIRECTOR_GENERAL, Role.DIRECTOR_ADMINISTRATIVO, Role.ASISTENTE_DIRECCION, Role.COREOGRAFO, Role.PROFESOR)
  listGroups(@CurrentUser() user: PublicUser) { return this.groupsService.listGroups(user); }
  @Post('groups') createGroup(@Body() dto: CreateGroupDto) { return this.groupsService.createGroup(dto); }
  @Patch('groups/:id') updateGroup(@Param('id') id: string, @Body() dto: UpdateGroupDto) { return this.groupsService.updateGroup(id, dto); }
  @Delete('groups/:id') deactivateGroup(@Param('id') id: string) { return this.groupsService.deactivateGroup(id); }
  @Post('groups/:id/teachers') assignTeacher(@Param('id') id: string, @Body() dto: AssignTeacherDto) { return this.groupsService.assignTeacher(id, dto.userId); }
  @Delete('groups/:id/teachers/:userId') removeTeacher(@Param('id') id: string, @Param('userId') userId: string) { return this.groupsService.removeTeacher(id, userId); }
  @Get('calendar')
  @Roles(Role.DIRECTOR_GENERAL, Role.DIRECTOR_ADMINISTRATIVO, Role.ASISTENTE_DIRECCION, Role.COREOGRAFO, Role.PROFESOR)
  calendar(@Query('from') from: string, @Query('to') to: string, @Query('groupId') groupId: string | undefined, @CurrentUser() user: PublicUser) {
    return this.groupsService.calendar(from, to, user, groupId);
  }
  @Post('groups/:id/schedules') addSchedule(@Param('id') id: string, @Body() body: { dayOfWeek: number; startTime: string; endTime: string; location?: string }) { return this.groupsService.addSchedule(id, body); }
  @Post('groups/:id/students/bulk') enrollMany(@Param('id') id: string, @Body() body: { studentIds: string[] }) { return this.groupsService.enrollMany(id, body.studentIds); }
  @Get('groups/:id/roster')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  roster(@Param('id') id: string) { return this.groupsService.rosterCsv(id); }
  @Post('groups/:id/students') assignStudent(@Param('id') id: string, @Body() dto: AssignStudentDto) { return this.groupsService.assignStudent(id, dto.studentId); }
  @Delete('groups/:id/students/:studentId') withdrawStudent(@Param('id') id: string, @Param('studentId') studentId: string) { return this.groupsService.withdrawStudent(id, studentId); }
}
