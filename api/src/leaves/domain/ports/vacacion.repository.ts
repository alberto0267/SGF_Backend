import { Rango } from '../value-objects/rango';
import { Vacacion } from '../vacacion';

export interface VacacionRepository {
  guardar(vacacion: Vacacion): Promise<void>;
  buscarPorId(id: string): Promise<Vacacion | null>;
  diasUsadosEnAnio(empleadoId: number, anio: number, excluyendoId?: string): Promise<number>;
  haySolapamiento(empleadoId: number, rango: Rango, excluyendoId?: string): Promise<boolean>;
}
