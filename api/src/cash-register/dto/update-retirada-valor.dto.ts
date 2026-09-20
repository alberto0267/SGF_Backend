import { IsNumber, Min } from 'class-validator';

export class UpdateRetiradaValorDto {
  @IsNumber()
  @Min(0)
  valor: number;
}
