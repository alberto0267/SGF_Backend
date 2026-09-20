import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class QueryDaySummaryDto {
  @IsDateString()
  date: string;

  @IsOptional()
  @IsUUID()
  workcenterUuid?: string;
}
