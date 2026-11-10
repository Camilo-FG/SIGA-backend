import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { EnrollmentStatus } from '../../../generated/prisma/client.js';

export class ListStudentsQueryDto {
  @IsOptional() @IsString() @MaxLength(100)
  search?: string;

  @IsOptional() @IsEnum(EnrollmentStatus)
  status?: EnrollmentStatus;

  @IsOptional() @IsString() @MaxLength(36)
  groupId?: string;

  @IsOptional() @IsString() @MaxLength(36)
  disciplineId?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit?: number;
}
