import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Role } from '../../generated/prisma/client.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CreateStudentDto } from './dto/create-student.dto.js';
import { ListStudentsQueryDto } from './dto/list-students-query.dto.js';
import { UpdateStudentDto } from './dto/update-student.dto.js';
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

  @Get(':id')
  findById(@Param('id') id: string) { return this.studentsService.findById(id); }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateStudentDto) { return this.studentsService.update(id, dto); }

  @Delete(':id')
  deactivate(@Param('id') id: string) { return this.studentsService.deactivate(id); }

}
