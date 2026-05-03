import {
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MinLength,
  ValidateNested,
} from 'class-validator';

import { Type } from 'class-transformer';

export class CreateWorkCenterDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsEmail({}, { message: 'El email del centro de trabajo no tiene un formato válido' })
  @IsOptional()
  email?: string;
}

export class CreateOwnerDto {
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsString()
  @IsNotEmpty()
  dni: string;

  @IsEmail({}, { message: 'El email del owner no tiene un formato válido' })
  @IsNotEmpty({ message: 'El email del owner es obligatorio' })
  email: string;

  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @Matches(/^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*()\-_=+[\]{};':"\\|,.<>/?]).{8,}$/, {
    message: 'La contraseña debe contener al menos una mayúscula, un número y un carácter especial',
  })
  password: string;

  @IsString()
  @IsOptional()
  phone?: string;
}

export class CreateCompanyDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  nif: string;

  @IsString()
  @IsNotEmpty()
  address: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsEmail({}, { message: 'El email de la empresa no tiene un formato válido' })
  @IsOptional()
  email?: string;

  @ValidateNested()
  @Type(() => CreateOwnerDto)
  owner: CreateOwnerDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateWorkCenterDto)
  workCenters: CreateWorkCenterDto[];
}
