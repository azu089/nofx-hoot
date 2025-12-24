import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { randomUUID } from 'crypto';

/**
 * Request ID 拦截器
 *
 * 功能：
 * 1. 为每个请求生成唯一 request_id (UUID v4)
 * 2. 将 request_id 注入到 request 对象
 * 3. 将 request_id 添加到响应头
 */
@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    // 生成唯一 request_id
    const requestId = randomUUID();

    // 注入到 request 对象，供日志和异常过滤器使用
    request.requestId = requestId;

    // 添加到响应头，方便前端追踪
    response.setHeader('X-Request-ID', requestId);

    return next.handle();
  }
}
