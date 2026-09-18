import {
  ExceptionFilter, Catch, ArgumentsHost, Logger,
  HttpException, HttpStatus,
} from '@nestjs/common';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = exception instanceof HttpException
      ? (exception.getResponse() as any).message ?? exception.message
      : 'Internal server error';

    this.log(status, request, exception);

    response.status(status).json({
      statusCode: status,
      message: Array.isArray(message) ? message[0] : message,
      errors: Array.isArray(message) ? message : undefined,
    });
  }

  // 5xx (and anything that isn't a recognized HttpException, e.g. a raw DB
  // error) is a bug — log it as an error with a stack trace so it's actually
  // debuggable. 4xx is expected client-facing behavior (bad input, wrong
  // password, missing auth) — log it at a lower level with just a one-liner,
  // not a full stack, so routine 400/401/404s don't drown out real problems.
  // Never log the request body — it can carry passwords or tokens.
  private log(status: number, request: any, exception: unknown) {
    const method = request?.method ?? 'UNKNOWN';
    const url = request?.originalUrl ?? request?.url ?? 'unknown';
    const context = `${method} ${url} -> ${status}`;

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      const stack = exception instanceof Error ? exception.stack : undefined;
      const detail = exception instanceof Error ? exception.message : String(exception);
      this.logger.error(`${context} :: ${detail}`, stack);
    } else {
      const detail = exception instanceof Error ? exception.message : String(exception);
      this.logger.warn(`${context} :: ${detail}`);
    }
  }
}
