import { IsString, MaxLength } from 'class-validator';

export class AssignTeacherDto {
  @IsString() @MaxLength(36)
  userId: string;
}
