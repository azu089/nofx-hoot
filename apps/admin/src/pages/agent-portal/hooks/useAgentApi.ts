/**
 * 代理商后台 API Hook
 */
import { useState, useCallback } from 'react';
import { useMessage } from '../../../hooks';
import { API_BASE } from '../constants/styles';

interface FetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: Record<string, any>;
}

export function useAgentApi<T>() {
  const message = useMessage();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<T | null>(null);

  const fetchApi = useCallback(async (endpoint: string, options: FetchOptions = {}) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('agent_token');

      if (!token) {
        window.location.href = '/agent/login';
        return null;
      }

      const config: RequestInit = {
        method: options.method || 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      };

      if (options.body) {
        config.body = JSON.stringify(options.body);
      }

      const response = await fetch(`${API_BASE}${endpoint}`, config);

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem('agent_token');
          localStorage.removeItem('agent_info');
          window.location.href = '/agent/login';
          return null;
        }
        throw new Error('请求失败');
      }

      const result = await response.json();

      if (result.code === 0) {
        setData(result.data);
        return result.data;
      } else {
        throw new Error(result.message || '请求失败');
      }
    } catch (error: any) {
      message.error(error.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [message]);

  return { loading, data, fetchApi, setData };
}

// 获取代理商 Token
export function getAgentToken(): string | null {
  return localStorage.getItem('agent_token');
}

// 复制到剪贴板
export function copyToClipboard(text: string, label: string, messageApi: ReturnType<typeof useMessage>) {
  navigator.clipboard.writeText(text);
  messageApi.success(`${label}已复制到剪贴板`);
}
