import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { AttendanceStatus } from '../../../generated/prisma/client.js';

export class AttendanceItemDto {
  @IsString() @MaxLength(36)
  studentId: string;

  @IsEnum(AttendanceStatus)
  status: AttendanceStatus;

  @IsOptional() @IsString() @MaxLength(300)
  observation?: string;
}

export class RecordAttendanceDto {
  @IsString() @MaxLength(36)
  groupId: string;

  @IsString()
  date: string;

  @IsArray() @ValidateNested({ each: true }) @Type(() => AttendanceItemDto)
  records: AttendanceItemDto[];
}
