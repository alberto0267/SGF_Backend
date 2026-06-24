export interface VacacionReadModel {
  uuid: string;
  asunto: string;
  inicio: string;
  fin: string;
  dias: number;
  estado: string;
  empleadoUuid: string;
  empleadoNombre: string;
  comentarios: { autor: string; texto: string; fecha: string }[];
}

export interface VacacionConsultas {
  listarPorEmpleado(empleadoId: number): Promise<VacacionReadModel[]>;
  listarPorEmpresa(empresaId: number): Promise<VacacionReadModel[]>;
  listarPorCentros(workcenterIds: number[]): Promise<VacacionReadModel[]>;
}
