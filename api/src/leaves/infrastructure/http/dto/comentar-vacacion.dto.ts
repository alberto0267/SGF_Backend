import { IsString, MinLength } from 'class-validator';

export class ComentarVacacionDto {
  @IsString()
  @MinLength(1)
  texto: string;
}
