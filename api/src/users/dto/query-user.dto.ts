import { IsOptional, IsUUID } from 'class-validator';

export class QueryUserDto {
  @IsOptional()
  @IsUUID()
  companyUuid?: string;
}
