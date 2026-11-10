import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { AuthResponse } from './auth.types.js';
import { AuthService } from './auth.service.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import { Public } from './decorators/public.decorator.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { SetActiveDto } from './dto/set-active.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import type { PublicUser } from '../../users/users.service.js';
import { Role } from '../../generated/prisma/client.js';
import { UsersService } from '../../users/users.service.js';
import { Roles } from './decorators/roles.decorator.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService, private readonly usersService: UsersService) {}

  @Roles(Role.DIRECTOR_GENERAL, Role.DIRECTOR_ADMINISTRATIVO)
  @Get('users')
  users(@Query('role') role?: Role, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.usersService.listInternal(role, undefined, page ? Number(page) : 1, limit ? Number(limit) : 100);
  }

  @Roles(Role.DIRECTOR_GENERAL, Role.DIRECTOR_ADMINISTRATIVO)
  @Patch('users/:id')
  updateUser(@CurrentUser() user: PublicUser, @Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(user, id, dto);
  }

  @Roles(Role.DIRECTOR_GENERAL, Role.DIRECTOR_ADMINISTRATIVO)
  @Patch('users/:id/active')
  setActive(@CurrentUser() user: PublicUser, @Param('id') id: string, @Body() dto: SetActiveDto) {
    return this.usersService.setActive(user, id, dto.active);
  }

  @Roles(Role.DIRECTOR_GENERAL, Role.DIRECTOR_ADMINISTRATIVO)
  @Post('users/:id/reset-password')
  resetPassword(@CurrentUser() user: PublicUser, @Param('id') id: string) {
    return this.usersService.resetPassword(user, id);
  }

  @Patch('password')
  async changePassword(@CurrentUser() user: PublicUser, @Body() dto: ChangePasswordDto) {
    await this.usersService.changePassword(user.id, dto.currentPassword, dto.newPassword);
    return { ok: true };
  }

  @Roles(Role.DIRECTOR_GENERAL, Role.DIRECTOR_ADMINISTRATIVO)
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(@CurrentUser() user: PublicUser, @Body() dto: RegisterDto): Promise<PublicUser> {
    return this.authService.register(dto, user);
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto): Promise<AuthResponse> {
    return this.authService.login(dto);
  }

  @Get('me')
  me(@CurrentUser() user: PublicUser | undefined): PublicUser | undefined {
    return user;
  }
}
