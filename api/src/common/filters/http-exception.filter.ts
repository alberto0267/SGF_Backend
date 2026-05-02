import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

const DEFAULT_CODES: Record<number, string> = {
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  429: 'RATE_LIMITED',
  500: 'INTERNAL_ERROR',
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttp = exception instanceof HttpException;
    const statusCode = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    if (!isHttp || statusCode >= 500) {
      this.logger.error(
        `Unhandled exception on ${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    if (!isHttp) {
      response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        code: 'INTERNAL_ERROR',
        message: 'Ha ocurrido un error interno. Inténtalo más tarde.',
      });
      return;
    }

    const exceptionBody = exception.getResponse();
    const isBodyObject = typeof exceptionBody === 'object' && exceptionBody !== null;
    const bodyRecord = isBodyObject ? (exceptionBody as Record<string, unknown>) : {};

    const message =
      typeof exceptionBody === 'string'
        ? exceptionBody
        : typeof bodyRecord['message'] === 'string'
          ? bodyRecord['message']
          : 'Error en la solicitud.';

    const code =
      typeof bodyRecord['code'] === 'string'
        ? bodyRecord['code']
        : (DEFAULT_CODES[statusCode] ?? 'ERROR');

    const { statusCode: _s, message: _m, error: _e, code: _c, ...extras } = bodyRecord;

    response.status(statusCode).json({
      code,
      message,
      ...extras,
    });
  }
}
