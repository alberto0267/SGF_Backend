import { IsBoolean, IsEmail, IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class UpdateMemberDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  dni?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @Matches(/^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*()\-_=+[\]{};':"\\|,.<>/?]).{8,}$/, {
    message: 'La contraseña debe contener al menos una mayúscula, un número y un carácter especial',
  })
  newPassword?: string;
}

export class UpdateMemberActiveDto {
  @IsBoolean()
  active!: boolean;
}

export class UpdateMemberRoleDto {
  @IsString()
  role!: 'Owner' | 'Manager' | 'Employee';
}
