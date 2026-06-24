import { IsInt, IsNumber, IsString, Min, MinLength } from 'class-validator';

export class EditCierreDto {
  @IsNumber()
  @Min(0)
  efectivo: number;

  @IsInt()
  @Min(0)
  nRet: number;

  @IsNumber()
  @Min(0)
  datafono: number;

  @IsNumber()
  @Min(0)
  cTarjeta: number;

  @IsNumber()
  difArqueoEf: number;

  @IsString()
  @MinLength(1)
  comentario: string;
}
