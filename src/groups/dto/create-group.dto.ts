import { IsInt, IsOptional, IsString, MaxLength, MinLength, Min, Max } from 'class-validator';

export class CreateGroupDto {
  @IsString() @MinLength(2) @MaxLength(100)
  name: string;

  @IsString() @MaxLength(36)
  disciplineId: string;

  @IsOptional() @IsInt() @Min(0) @Max(6)
  dayOfWeek?: number;

  @IsOptional() @IsString() @MaxLength(5)
  startTime?: string;

  @IsOptional() @IsString() @MaxLength(5)
  endTime?: string;

  @IsOptional() @IsString() @MaxLength(150)
  location?: string;
}
