import { IsDateString, IsNumber, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class CreateChargeDto {
  @IsString() @MaxLength(36)
  studentId: string;

  @IsString() @MinLength(2) @MaxLength(120)
  concept: string;

  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01)
  amount: number;

  @IsString() @MinLength(1) @MaxLength(30)
  period: string;

  @IsOptional() @IsDateString()
  dueDate?: string;
}
