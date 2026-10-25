import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
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
  @Post('groups/:id/students') assignStudent(@Param('id') id: string, @Body() dto: AssignStudentDto) { return this.groupsService.assignStudent(id, dto.studentId); }
  @Delete('groups/:id/students/:studentId') withdrawStudent(@Param('id') id: string, @Param('studentId') studentId: string) { return this.groupsService.withdrawStudent(id, studentId); }
}
