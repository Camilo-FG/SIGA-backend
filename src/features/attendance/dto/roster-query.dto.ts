import { IsDateString, IsString, MaxLength } from 'class-validator';

export class RosterQueryDto {
  @IsString() @MaxLength(36)
  groupId: string;

  @IsDateString()
  date: string;
}
