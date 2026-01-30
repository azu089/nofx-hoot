import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { ApiResponse } from '../dto/api-response.dto';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const requestId = (request.headers['x-request-id'] as string) || uuidv4();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 50001; // INTERNAL_ERROR
    let message = '服务器内部错误';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        const res = exceptionResponse as Record<string, unknown>;
        message = (res.message as string) || exception.message;
        code = (res.code as number) || this.mapHttpStatusToCode(status);
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    // 记录错误日志
    this.logger.error(
      `[${requestId}] ${request.method} ${request.url} - ${status} - ${message}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    const apiResponse = ApiResponse.error(code, message);
    apiResponse.requestId = requestId;

    response.status(status).json(apiResponse);
  }

  private mapHttpStatusToCode(status: number): number {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 40001; // PARAM_INVALID
      case HttpStatus.UNAUTHORIZED:
        return 41001; // AUTH_FAILED
      case HttpStatus.FORBIDDEN:
        return 42001; // PERMISSION_DENIED
      case HttpStatus.NOT_FOUND:
        return 43002; // USER_NOT_FOUND
      default:
        return 50001; // INTERNAL_ERROR
    }
  }
}
