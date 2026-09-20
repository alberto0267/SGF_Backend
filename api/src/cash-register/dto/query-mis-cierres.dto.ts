import { IsDateString, IsOptional } from 'class-validator';

export class QueryMisCierresDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
