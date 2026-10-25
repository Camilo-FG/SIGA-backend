import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { EnrollmentStatus } from '../../generated/prisma/client.js';

export class ListStudentsQueryDto {
  @IsOptional() @IsString() @MaxLength(100)
  search?: string;

  @IsOptional() @IsEnum(EnrollmentStatus)
  status?: EnrollmentStatus;
}
