// 统一响应格式
export class ApiResponse<T> {
  code: number;
  message: string;
  data: T | null;
  requestId: string;

  constructor(data: T | null, message = 'success', code = 0) {
    this.code = code;
    this.message = message;
    this.data = data;
    this.requestId = '';
  }

  static success<T>(data: T, message = 'success'): ApiResponse<T> {
    return new ApiResponse(data, message, 0);
  }

  static error<T = null>(
    code: number,
    message: string,
    data: T | null = null,
  ): ApiResponse<T> {
    return new ApiResponse(data, message, code);
  }
}

// 错误码规范
export const ErrorCode = {
  // 成功
  SUCCESS: 0,

  // 参数错误 40000-40999
  PARAM_INVALID: 40001,
  PARAM_MISSING: 40002,

  // 认证错误 41000-41999
  AUTH_FAILED: 41001,
  TOKEN_EXPIRED: 41002,
  TOKEN_INVALID: 41003,

  // 权限错误 42000-42999
  PERMISSION_DENIED: 42001,

  // 业务错误 43000-43999
  USER_EXISTS: 43001,
  USER_NOT_FOUND: 43002,
  API_KEY_INVALID: 43003,
  STRATEGY_NOT_FOUND: 43004,
  SUBSCRIPTION_EXISTS: 43005,
  INSUFFICIENT_BALANCE: 43006,

  // 系统错误 50000-50999
  INTERNAL_ERROR: 50001,
  DATABASE_ERROR: 50002,
  EXCHANGE_ERROR: 50003,
} as const;
