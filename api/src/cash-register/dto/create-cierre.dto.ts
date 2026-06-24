import { IsDateString, IsInt, IsNumber, Min } from 'class-validator';

export class CreateCierreDto {
  @IsDateString()
  date: string;

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
}
