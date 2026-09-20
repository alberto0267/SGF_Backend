import { IsUUID, Matches } from 'class-validator';

export class UpdateResumenHoraDto {
  @IsUUID()
  workcenterUuid: string;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'hora debe tener formato HH:mm' })
  hora: string;
}
