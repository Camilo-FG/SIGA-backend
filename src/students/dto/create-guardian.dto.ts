import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateGuardianDto {
  @IsString() @MinLength(2) @MaxLength(100)
  firstName: string;

  @IsString() @MinLength(2) @MaxLength(100)
  lastName: string;

  @IsOptional() @IsEmail() @MaxLength(255)
  email?: string;

  @IsOptional() @IsString() @MaxLength(30)
  phone?: string;
}
