import { IsDateString, IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { EnrollmentStatus } from '../../../generated/prisma/client.js';

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
}
