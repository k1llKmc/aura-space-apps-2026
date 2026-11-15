import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { STATUS_CODES } from 'node:http';
import type { ApiErrorResponse } from '@aura/shared-types';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const isHttpException = exception instanceof HttpException;
    const statusCode = isHttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const payload = isHttpException ? exception.getResponse() : undefined;
    const message = typeof payload === 'object' && payload !== null && 'message' in payload
      ? (payload as { message: string | string[] }).message
      : isHttpException ? exception.message : 'An unexpected server error occurred.';

    if (!isHttpException) this.logger.error(`Unhandled error for ${request.method} ${request.url}`, exception instanceof Error ? exception.stack : undefined);

    const envelope: ApiErrorResponse = {
      statusCode,
      error: STATUS_CODES[statusCode] ?? 'Error',
      message: Array.isArray(message) ? message : [message],
      timestamp: new Date().toISOString(),
    };
    response.status(statusCode).json(envelope);
  }
}
