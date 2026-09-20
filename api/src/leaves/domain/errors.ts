export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValorInvalido extends DomainError {}

export class OperacionNoPermitida extends DomainError {}
