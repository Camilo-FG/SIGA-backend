import { Body, Controller, Delete, Get, Param, Patch, Post, Query, StreamableFile, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '../../generated/prisma/client.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import type { UploadedFile as StoredUpload } from '../../files/files.service.js';
import type { PublicUser } from '../../users/users.service.js';
import { CreateStudentDto } from './dto/create-student.dto.js';
import { ListStudentsQueryDto } from './dto/list-students-query.dto.js';
import { UpdateStudentDto } from './dto/update-student.dto.js';
import { StudentsService } from './students.service.js';

const readers = [Role.DIRECTOR_GENERAL, Role.DIRECTOR_ADMINISTRATIVO, Role.ASISTENTE_DIRECCION, Role.COREOGRAFO, Role.PROFESOR] as const;
const editors = [Role.DIRECTOR_ADMINISTRATIVO, Role.ASISTENTE_DIRECCION] as const;

@Controller('students')
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Get()
  @Roles(...readers)
  list(@CurrentUser() user: PublicUser, @Query() query: ListStudentsQueryDto) {
    return this.studentsService.list(user, query);
  }

  @Post()
  @Roles(...editors)
  create(@Body() dto: CreateStudentDto) { return this.studentsService.create(dto); }

  @Get(':id/photo')
  @Roles(...readers)
  async photo(@Param('id') id: string, @CurrentUser() user: PublicUser) {
    return new StreamableFile(await this.studentsService.openPhoto(id, user));
  }

  @Post(':id/photo')
  @Roles(...editors)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 } }))
  savePhoto(@Param('id') id: string, @UploadedFile() file: StoredUpload) {
    return this.studentsService.savePhoto(id, file);
  }

  @Get(':id')
  @Roles(...readers)
  findById(@Param('id') id: string, @CurrentUser() user: PublicUser) { return this.studentsService.findById(id, user); }

  @Patch(':id')
  @Roles(...editors)
  update(@Param('id') id: string, @Body() dto: UpdateStudentDto) { return this.studentsService.update(id, dto); }

  @Delete(':id')
  @Roles(...editors)
  deactivate(@Param('id') id: string, @CurrentUser() user: PublicUser) { return this.studentsService.deactivate(id, user); }
}
