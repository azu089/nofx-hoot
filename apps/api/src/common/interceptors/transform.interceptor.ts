import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ErrorCode } from '../constants/error-codes';

/**
 * 统一成功响应格式
 */
export interface SuccessResponse<T = any> {
  code: ErrorCode.SUCCESS;
  message: string;
  data: T;
  request_id: string;
}

/**
 * 响应转换拦截器
 *
 * 功能：
 * 将所有成功响应统一转换为标准格式：
 * {
 *   "code": 0,
 *   "message": "success",
 *   "data": { ... },
 *   "request_id": "uuid"
 * }
 */
@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, SuccessResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<SuccessResponse<T>> {
    const request = context.switchToHttp().getRequest();
    const requestId = request.requestId;

    return next.handle().pipe(
      map((data) => {
        // 检测是否已经是标准响应格式（避免重复包装）
        if (
          data &&
          typeof data === 'object' &&
          'code' in data &&
          'message' in data &&
          'data' in data
        ) {
          // 已经是标准格式，只添加 request_id
          return {
            ...data,
            request_id: requestId,
          };
        }

        // 普通数据，包装成标准格式
        return {
          code: ErrorCode.SUCCESS,
          message: 'success',
          data: data ?? null,
          request_id: requestId,
        };
      }),
    );
  }
}
