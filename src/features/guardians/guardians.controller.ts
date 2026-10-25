import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { Role } from '../../generated/prisma/client.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CreateGuardianDto } from './dto/create-guardian.dto.js';
import { LinkGuardianDto } from './dto/link-guardian.dto.js';
import { UpdateGuardianDto } from './dto/update-guardian.dto.js';
import { GuardiansService } from './guardians.service.js';

@Controller('students')
@Roles(Role.DIRECTOR_GENERAL, Role.DIRECTOR_ADMINISTRATIVO, Role.ASISTENTE_DIRECCION)
export class GuardiansController {
  constructor(private readonly guardiansService: GuardiansService) {}
  @Post('guardians') create(@Body() dto: CreateGuardianDto) { return this.guardiansService.create(dto); }
  @Get('guardians') list() { return this.guardiansService.list(); }
  @Get('guardians/:guardianId') find(@Param('guardianId') id: string) { return this.guardiansService.find(id); }
  @Patch('guardians/:guardianId') update(@Param('guardianId') id: string, @Body() dto: UpdateGuardianDto) { return this.guardiansService.update(id, dto); }
  @Post(':id/guardians/:guardianId') link(@Param('id') studentId: string, @Param('guardianId') guardianId: string, @Body() dto: LinkGuardianDto) { return this.guardiansService.link(studentId, guardianId, dto.relationship); }
  @Delete(':id/guardians/:guardianId') unlink(@Param('id') studentId: string, @Param('guardianId') guardianId: string) { return this.guardiansService.unlink(studentId, guardianId); }
}
