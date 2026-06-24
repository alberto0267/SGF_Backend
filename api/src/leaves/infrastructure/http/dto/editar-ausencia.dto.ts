import { IsDateString, IsIn, IsInt, IsOptional, IsString, Matches, Min, MinLength } from 'class-validator';

export class EditarAusenciaDto {
  @IsDateString()
  fecha: string;

  @IsIn(['dias', 'horas'])
  modalidad: 'dias' | 'horas';

  @IsOptional()
  @IsInt()
  @Min(1)
  dias?: number;

  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/)
  tramoInicio?: string;

  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/)
  tramoFin?: string;

  @IsString()
  @MinLength(1)
  motivo: string;
}
