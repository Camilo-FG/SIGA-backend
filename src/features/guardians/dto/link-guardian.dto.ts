import { IsString, MaxLength, MinLength } from 'class-validator';
export class LinkGuardianDto {
  @IsString() @MinLength(2) @MaxLength(80)
  relationship: string;
}
