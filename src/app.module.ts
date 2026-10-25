import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './features/auth/auth.module.js';
import { JwtAuthGuard } from './features/auth/guards/jwt-auth.guard.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { UsersModule } from './users/users.module.js';
import { RolesGuard } from './features/auth/guards/roles.guard.js';
import { StudentsModule } from './features/students/students.module.js';
import { GroupsModule } from './features/groups/groups.module.js';
import { AttendanceModule } from './features/attendance/attendance.module.js';
import { PaymentsModule } from './features/payments/payments.module.js';
import { DashboardModule } from './features/dashboard/dashboard.module.js';
import { GuardiansModule } from './features/guardians/guardians.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true }),
    PrismaModule,
    UsersModule,
    AuthModule,
    StudentsModule,
    GroupsModule,
    AttendanceModule,
    PaymentsModule,
    DashboardModule,
    GuardiansModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Every route requires a valid JWT unless it is marked with @Public().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
