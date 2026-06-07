import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDateString, IsNumber, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';

class OvertimeItemDto {
  @IsUUID()
  employeeUuid: string;

  @IsNumber()
  @Min(0.25)
  hours: number;
}

export class CreateOvertimeRequestDto {
  @IsDateString()
  date: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OvertimeItemDto)
  items: OvertimeItemDto[];
}
