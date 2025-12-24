import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ErrorCode, HTTP_TO_ERROR_CODE } from '../constants/error-codes';

/**
 * 统一错误响应格式
 */
export interface ErrorResponse {
  code: ErrorCode;
  message: string;
  data: null;
  request_id: string;
}

/**
 * 全局异常过滤器
 *
 * 功能：
 * 1. 捕获所有 HTTP 异常
 * 2. 统一错误响应格式
 * 3. 记录错误日志（包含 request_id）
 * 4. 映射 HTTP 状态码到业务错误码
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // 获取 request_id
    const requestId = (request as any).requestId || 'unknown';

    // 确定 HTTP 状态码
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // 确定业务错误码
    const code = HTTP_TO_ERROR_CODE[status] || ErrorCode.INTERNAL_ERROR;

    // 确定错误消息
    let message = '系统错误，请稍后重试';

    if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        // 处理 ValidationPipe 的错误格式
        const resp = exceptionResponse as any;
        if (Array.isArray(resp.message)) {
          message = `参数错误：${resp.message.join(', ')}`;
        } else if (resp.message) {
          message = resp.message;
        } else if (resp.error) {
          message = resp.error;
        }
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    // 构造错误响应
    const errorResponse: ErrorResponse = {
      code,
      message,
      data: null,
      request_id: requestId,
    };

    // 记录错误日志
    this.logError(request, status, message, requestId, exception);

    // 返回统一格式的错误响应
    response.status(status).json(errorResponse);
  }

  /**
   * 记录错误日志
   */
  private logError(
    request: Request,
    status: number,
    message: string,
    requestId: string,
    exception: unknown,
  ) {
    const { method, url } = request;

    // 5xx 错误记录完整堆栈
    if (status >= 500) {
      this.logger.error(
        `[${requestId}] ${method} ${url} - ${status} - ${message}`,
        exception instanceof Error ? exception.stack : '',
      );
    } else {
      // 4xx 错误只记录基本信息
      this.logger.warn(
        `[${requestId}] ${method} ${url} - ${status} - ${message}`,
      );
    }
  }
}
