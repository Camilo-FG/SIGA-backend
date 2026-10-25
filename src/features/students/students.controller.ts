import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Role } from '../../generated/prisma/client.js';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { CreateGuardianDto } from './dto/create-guardian.dto.js';
import { CreateStudentDto } from './dto/create-student.dto.js';
import { LinkGuardianDto } from './dto/link-guardian.dto.js';
import { ListStudentsQueryDto } from './dto/list-students-query.dto.js';
import { UpdateStudentDto } from './dto/update-student.dto.js';
import { UpdateGuardianDto } from './dto/update-guardian.dto.js';
import { StudentsService } from './students.service.js';

@Controller('students')
@Roles(Role.DIRECTOR_GENERAL, Role.DIRECTOR_ADMINISTRATIVO, Role.ASISTENTE_DIRECCION)
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Get()
  list(@Query() query: ListStudentsQueryDto) {
    return this.studentsService.list(query.search, query.status);
  }

  @Post()
  create(@Body() dto: CreateStudentDto) { return this.studentsService.create(dto); }

  @Post('guardians')
  createGuardian(@Body() dto: CreateGuardianDto) { return this.studentsService.createGuardian(dto); }

  @Get('guardians')
  listGuardians() { return this.studentsService.listGuardians(); }

  @Get('guardians/:guardianId')
  findGuardian(@Param('guardianId') id: string) { return this.studentsService.findGuardian(id); }

  @Patch('guardians/:guardianId')
  updateGuardian(@Param('guardianId') id: string, @Body() dto: UpdateGuardianDto) { return this.studentsService.updateGuardian(id, dto); }

  @Get(':id')
  findById(@Param('id') id: string) { return this.studentsService.findById(id); }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateStudentDto) { return this.studentsService.update(id, dto); }

  @Delete(':id')
  deactivate(@Param('id') id: string) { return this.studentsService.deactivate(id); }

  @Post(':id/guardians/:guardianId')
  linkGuardian(@Param('id') studentId: string, @Param('guardianId') guardianId: string, @Body() dto: LinkGuardianDto) {
    return this.studentsService.linkGuardian(studentId, guardianId, dto.relationship);
  }

  @Delete(':id/guardians/:guardianId')
  unlinkGuardian(@Param('id') studentId: string, @Param('guardianId') guardianId: string) { return this.studentsService.unlinkGuardian(studentId, guardianId); }
}
