import { IsOptional, IsString } from 'class-validator';

export class ResolverVacacionDto {
  @IsOptional()
  @IsString()
  comentario?: string;
}
