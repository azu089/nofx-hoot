import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Request } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { ApiResponse } from '../dto/api-response.dto';

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    const request = context.switchToHttp().getRequest<Request>();
    const requestId = (request.headers['x-request-id'] as string) || uuidv4();

    return next.handle().pipe(
      map((data) => {
        // 如果已经是 ApiResponse 格式，直接返回
        if (data && typeof data === 'object' && 'code' in data) {
          data.requestId = requestId;
          return data;
        }

        // 包装成统一格式
        const response = ApiResponse.success(data);
        response.requestId = requestId;
        return response;
      }),
    );
  }
}
