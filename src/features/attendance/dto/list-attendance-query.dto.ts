import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class ListAttendanceQueryDto {
  @IsOptional() @IsString() @MaxLength(36)
  groupId?: string;

  @IsOptional() @IsString() @MaxLength(36)
  studentId?: string;

  @IsOptional() @IsDateString()
  from?: string;

  @IsOptional() @IsDateString()
  to?: string;
}
