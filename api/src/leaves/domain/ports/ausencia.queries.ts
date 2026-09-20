export interface AusenciaReadModel {
  uuid: string;
  fecha: string;
  modalidad: string;
  dias: number | null;
  tramoInicio: string | null;
  tramoFin: string | null;
  horas: number | null;
  motivo: string;
  estado: string;
  empleadoUuid: string;
  empleadoNombre: string;
  comentarios: { autor: string; texto: string; fecha: string }[];
}

export interface AusenciaConsultas {
  listarPorEmpleado(empleadoId: number): Promise<AusenciaReadModel[]>;
  listarPorEmpresa(empresaId: number): Promise<AusenciaReadModel[]>;
  listarPorCentros(workcenterIds: number[]): Promise<AusenciaReadModel[]>;
}
