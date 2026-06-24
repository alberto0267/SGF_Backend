import { IsDateString, IsString, MaxLength, MinLength } from 'class-validator';

export class EditarVacacionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  asunto: string;

  @IsDateString()
  inicio: string;

  @IsDateString()
  fin: string;
}
