export interface DirectorioUsuarios {
  empresaDe(usuarioId: number): Promise<number | null>;
  centrosDe(usuarioId: number): Promise<number[]>;
  ownersDeEmpresa(empresaId: number): Promise<number[]>;
}
