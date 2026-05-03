import { IsEmail, IsOptional, IsString } from 'class-validator';

export class UpdateWorkcenterDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}
