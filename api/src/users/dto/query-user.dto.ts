import { IsOptional, IsString, IsUUID } from 'class-validator';

export class QueryUserDto {
  @IsOptional()
  @IsUUID()
  companyUuid?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsUUID()
  workcenterUuid?: string;
}
