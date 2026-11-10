import { Type } from 'class-transformer';
import { IsDateString, IsNumber, IsOptional, IsString, Matches, MaxLength, Min, MinLength } from 'class-validator';

export class CreateChargeDto {
  @IsString() @MaxLength(36)
  studentId: string;

  @IsString() @MinLength(2) @MaxLength(120)
  concept: string;

  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El importe debe ser un número mayor a cero, con hasta dos decimales.' }) @Min(0.01, { message: 'El importe debe ser un número mayor a cero, con hasta dos decimales.' })
  amount: number;

  @IsString() @Matches(/^(19|20)\d{2}-(0[1-9]|1[0-2])$/, { message: 'El período debe ser un mes, por ejemplo 2026-11.' })
  period: string;

  @IsOptional() @IsDateString()
  dueDate?: string;
}
