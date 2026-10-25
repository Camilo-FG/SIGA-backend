import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';
import type { AuthResponse } from './auth.types.js';
import { AuthService } from './auth.service.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import { Public } from './decorators/public.decorator.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import type { PublicUser } from '../../users/users.service.js';
import { Role } from '../../generated/prisma/client.js';
import { UsersService } from '../../users/users.service.js';
import { Roles } from './decorators/roles.decorator.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService, private readonly usersService: UsersService) {}

  @Roles(Role.DIRECTOR_GENERAL, Role.DIRECTOR_ADMINISTRATIVO, Role.ASISTENTE_DIRECCION)
  @Get('users')
  users(@Query('role') role?: Role) { return this.usersService.listInternal(role); }

  @Roles(Role.DIRECTOR_GENERAL)
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(@CurrentUser() user: PublicUser, @Body() dto: RegisterDto): Promise<PublicUser> {
    return this.authService.register(dto, user);
  }

  @Public()
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
