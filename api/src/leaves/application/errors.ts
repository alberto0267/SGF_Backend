import { DomainError } from '../domain/errors';

export class SaldoVacacionesExcedido extends DomainError {
  constructor(usados: number, solicitados: number) {
    super(`Saldo excedido: ${usados} días usados + ${solicitados} solicitados superan los 30 días anuales`);
  }
}

export class FechasSolapadas extends DomainError {
  constructor() {
    super('Las fechas solicitadas se solapan con otra solicitud existente');
  }
}

export class VacacionNoEncontrada extends DomainError {
  constructor() {
    super('Solicitud de vacaciones no encontrada');
  }
}

export class AccesoDenegado extends DomainError {
  constructor() {
    super('No tienes acceso a esta solicitud');
  }
}

export class AusenciaNoEncontrada extends DomainError {
  constructor() {
    super('Solicitud de ausencia no encontrada');
  }
}
