import { IsString, MaxLength } from 'class-validator';

export class AssignStudentDto {
  @IsString() @MaxLength(36)
  studentId: string;
}
