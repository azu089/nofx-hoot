import { api } from './client';
import { ApiResponse, Wallet, ApiKey, ApiKeyVerification } from './types';

/**
 * 钱包相关 API
 */
export const walletApi = {
  /**
   * 获取当前用户钱包余额
   */
  getBalance: () => api.get<never, ApiResponse<Wallet>>('/wallets/me'),

  /**
   * 获取用户 API Keys
   */
  getApiKeys: () => api.get<never, ApiResponse<ApiKey[]>>('/api-keys'),

  /**
   * 添加 API Key
   */
  addApiKey: (data: {
    exchange: string;
    label: string;
    apiKey: string;
    secretKey: string;
    passphrase?: string;
  }) => api.post<never, ApiResponse<ApiKey>>('/api-keys', data),

  /**
   * 验证 API Key
   */
  verifyApiKey: (id: string) =>
    api.post<never, ApiResponse<ApiKeyVerification>>(`/api-keys/${id}/verify`),

  /**
   * 删除 API Key
   */
  deleteApiKey: (id: string) => api.delete<never, ApiResponse<void>>(`/api-keys/${id}`),
};
