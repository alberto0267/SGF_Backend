import { IsDateString, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class SolicitarVacacionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  asunto: string;

  @IsDateString()
  inicio: string;

  @IsDateString()
  fin: string;

  @IsOptional()
  @IsString()
  comentario?: string;
}
