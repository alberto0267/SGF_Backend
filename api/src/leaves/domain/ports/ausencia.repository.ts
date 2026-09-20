import { Ausencia } from '../ausencia';

export interface AusenciaRepository {
  guardar(ausencia: Ausencia): Promise<void>;
  buscarPorId(id: string): Promise<Ausencia | null>;
}
