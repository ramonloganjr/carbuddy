import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ExceptionFilter,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';

interface ErrorBody {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
  requestId?: string;
}

/**
 * Single error shape for the whole API.
 *
 * Two rules, both about not leaking internals:
 *   - Prisma errors are translated, never forwarded. A raw Prisma message
 *     exposes table and column names, which is free reconnaissance.
 *   - Unhandled 5xx responses carry a generic message; the real error goes to
 *     the log with a request id the user can quote to support.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const requestId = (request.headers['x-request-id'] as string | undefined) ?? undefined;

    const body = this.toErrorBody(exception, requestId);

    if (body.statusCode >= 500) {
      this.logger.error(
        `${request.method} ${request.url} -> ${body.statusCode}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(body.statusCode).json(body);
  }

  private toErrorBody(exception: unknown, requestId: string | undefined): ErrorBody {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      const message =
        typeof payload === 'string'
          ? payload
          : ((payload as { message?: string | string[] }).message ?? exception.message);

      return {
        statusCode: status,
        code: this.codeForStatus(status),
        message: Array.isArray(message) ? message.join(', ') : message,
        ...(typeof payload === 'object' && 'details' in (payload as object)
          ? { details: (payload as { details: unknown }).details }
          : {}),
        ...(requestId ? { requestId } : {}),
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return { ...this.translatePrisma(exception), ...(requestId ? { requestId } : {}) };
    }

    if (exception instanceof Prisma.PrismaClientValidationError) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        code: 'invalid_request',
        message: 'The request payload was not valid.',
        ...(requestId ? { requestId } : {}),
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'internal_error',
      message: 'Something went wrong on our side. Please try again.',
      ...(requestId ? { requestId } : {}),
    };
  }

  private translatePrisma(
    error: Prisma.PrismaClientKnownRequestError,
  ): Omit<ErrorBody, 'requestId'> {
    switch (error.code) {
      case 'P2002':
        return {
          statusCode: HttpStatus.CONFLICT,
          code: 'already_exists',
          message: 'That record already exists.',
        };
      case 'P2025':
        return {
          statusCode: HttpStatus.NOT_FOUND,
          code: 'not_found',
          message: 'That record could not be found.',
        };
      case 'P2003':
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          code: 'invalid_reference',
          message: 'That request referenced something that does not exist.',
        };
      default:
        return {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          code: 'database_error',
          message: 'Something went wrong on our side. Please try again.',
        };
    }
  }

  private codeForStatus(status: number): string {
    switch (status) {
      case 400:
        return 'invalid_request';
      case 401:
        return 'unauthenticated';
      case 403:
        return 'forbidden';
      case 404:
        return 'not_found';
      case 409:
        return 'conflict';
      case 422:
        return 'unprocessable';
      case 429:
        return 'rate_limited';
      default:
        return status >= 500 ? 'internal_error' : 'error';
    }
  }
}
