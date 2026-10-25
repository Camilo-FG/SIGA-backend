import { IsInt, IsOptional, IsString, MaxLength, MinLength, Min, Max, Matches } from 'class-validator';

export class CreateGroupDto {
  @IsString() @MinLength(2) @MaxLength(100)
  name: string;

  @IsString() @MaxLength(36)
  disciplineId: string;

  @IsOptional() @IsInt() @Min(0) @Max(6)
  dayOfWeek?: number;

  @IsOptional() @IsString() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  startTime?: string;

  @IsOptional() @IsString() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  endTime?: string;

  @IsOptional() @IsString() @MaxLength(150)
  location?: string;
}
