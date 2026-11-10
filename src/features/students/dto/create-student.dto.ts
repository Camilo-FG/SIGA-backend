import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsDateString, IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { EnrollmentStatus } from '../../../generated/prisma/client.js';

export class StudentGuardianInput {
  @IsString() @MaxLength(36)
  guardianId: string;

  @IsString() @MinLength(2) @MaxLength(80)
  relationship: string;

  @IsOptional() @IsBoolean()
  isPaymentResponsible?: boolean;
}

export class CreateStudentDto {
  @IsString() @MinLength(2) @MaxLength(100)
  firstName: string;

  @IsString() @MinLength(2) @MaxLength(100)
  lastName: string;

  @IsOptional() @IsDateString()
  birthDate?: string;

  @IsOptional() @IsEmail() @MaxLength(255)
  email?: string;

  @IsOptional() @IsString() @MaxLength(30)
  phone?: string;

  @IsOptional() @IsEnum(EnrollmentStatus)
  enrollmentStatus?: EnrollmentStatus;

  @IsOptional() @IsString() @MaxLength(200)
  emergencyContactName?: string;

  @IsOptional() @IsString() @MaxLength(30)
  emergencyContactPhone?: string;

  @IsOptional() @IsString() @MaxLength(30)
  nationalId?: string;

  @IsOptional() @IsString() @MaxLength(1000)
  notes?: string;

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => StudentGuardianInput)
  guardians?: StudentGuardianInput[];
}
