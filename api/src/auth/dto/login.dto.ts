import { IsEmail, IsString, Matches, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'El email no tiene un formato válido' })
  email: string;

  /**
   * Reglas de contraseña fuerte:
   * - Mínimo 8 caracteres
   * - Al menos 1 letra mayúscula
   * - Al menos 1 número
   * - Al menos 1 carácter especial
   *
   * La validación vive aquí (capa de aplicación), no en la DB.
   * La DB solo guarda el hash bcrypt resultante.
   */
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @Matches(/^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*()\-_=+[\]{};':"\\|,.<>/?]).{8,}$/, {
    message:
      'La contraseña debe contener al menos una mayúscula, un número y un carácter especial',
  })
  password: string;
}
