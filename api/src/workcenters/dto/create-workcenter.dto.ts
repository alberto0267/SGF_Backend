import { IsEmail, IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CreateWorkcenterDto {
  @IsUUID()
  companyUuid: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  address: string;

  @IsEmail()
  email: string;
}
