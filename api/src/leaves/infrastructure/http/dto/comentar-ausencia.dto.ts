import { IsString, MinLength } from 'class-validator';

export class ComentarAusenciaDto {
  @IsString()
  @MinLength(1)
  texto: string;
}
