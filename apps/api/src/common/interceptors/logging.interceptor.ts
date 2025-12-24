import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

/**
 * 日志拦截器
 *
 * 功能：
 * 1. 记录请求开始时间
 * 2. 记录请求结束时间和耗时
 * 3. 包含 request_id、method、url、status_code
 *
 * 日志格式：
 * [2024-01-01 12:00:00] [request_id] [INFO] GET /api/users - 200 - 15ms
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    const { method, url, requestId } = request;
    const startTime = Date.now();

    // 记录请求开始
    this.logger.log(
      `[${requestId}] ${method} ${url} - 请求开始`,
    );

    return next.handle().pipe(
      tap({
        next: () => {
          // 记录成功响应
          const endTime = Date.now();
          const duration = endTime - startTime;
          const { statusCode } = response;

          this.logger.log(
            `[${requestId}] ${method} ${url} - ${statusCode} - ${duration}ms`,
          );
        },
        error: (error) => {
          // 记录错误响应（错误详情由异常过滤器处理）
          const endTime = Date.now();
          const duration = endTime - startTime;
          const statusCode = error.status || 500;

          this.logger.error(
            `[${requestId}] ${method} ${url} - ${statusCode} - ${duration}ms`,
          );
        },
      }),
    );
  }
}
