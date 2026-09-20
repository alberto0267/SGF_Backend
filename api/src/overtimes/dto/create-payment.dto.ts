import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class CreatePaymentDto {
  @IsUUID()
  employeeUuid: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @Type(() => Number)
  @IsInt()
  @Min(2020)
  year: number;

  @IsNumber()
  @Min(0.25)
  hours: number;

  @IsIn(['money', 'hours_off'])
  method: 'money' | 'hours_off';

  @IsOptional()
  @IsString()
  comment?: string;
}
