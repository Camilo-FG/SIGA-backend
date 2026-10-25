import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { Role } from '../../generated/prisma/client.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
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
  @Get('groups') listGroups() { return this.groupsService.listGroups(); }
  @Post('groups') createGroup(@Body() dto: CreateGroupDto) { return this.groupsService.createGroup(dto); }
  @Patch('groups/:id') updateGroup(@Param('id') id: string, @Body() dto: UpdateGroupDto) { return this.groupsService.updateGroup(id, dto); }
  @Post('groups/:id/teachers') assignTeacher(@Param('id') id: string, @Body() dto: AssignTeacherDto) { return this.groupsService.assignTeacher(id, dto.userId); }
  @Post('groups/:id/students') assignStudent(@Param('id') id: string, @Body() dto: AssignStudentDto) { return this.groupsService.assignStudent(id, dto.studentId); }
}
