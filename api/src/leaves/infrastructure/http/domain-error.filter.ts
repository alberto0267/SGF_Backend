import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { AccesoDenegado, AusenciaNoEncontrada, VacacionNoEncontrada } from '../../application/errors';
import { DomainError, OperacionNoPermitida } from '../../domain/errors';

@Catch(DomainError)
export class DomainErrorFilter implements ExceptionFilter {
  catch(error: DomainError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse();

    let statusCode = HttpStatus.BAD_REQUEST;
    let code = 'VALIDATION_ERROR';

    if (error instanceof VacacionNoEncontrada || error instanceof AusenciaNoEncontrada) {
      statusCode = HttpStatus.NOT_FOUND;
      code = 'NOT_FOUND';
    } else if (error instanceof AccesoDenegado) {
      statusCode = HttpStatus.FORBIDDEN;
      code = 'FORBIDDEN';
    } else if (error instanceof OperacionNoPermitida) {
      statusCode = HttpStatus.CONFLICT;
      code = 'CONFLICT';
    }

    response.status(statusCode).json({ code, message: error.message });
  }
}
