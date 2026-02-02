/**
 * 翻译开关全局状态管理
 * 所有页面共享同一个翻译开关状态
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { useMessage } from '../hooks';

interface TranslateContextType {
  enabled: boolean;
  loading: boolean;
  toggle: (checked: boolean) => Promise<void>;
  refresh: () => Promise<void>;
}

const TranslateContext = createContext<TranslateContextType | null>(null);

export const TranslateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const message = useMessage();
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(false);

  // 获取翻译开关状态（仅在已登录时获取）
  const refresh = useCallback(async () => {
    // 检查是否已登录
    const token = localStorage.getItem('admin_token');
    if (!token) {
      return; // 未登录时不请求
    }
    try {
      const data = await api.get<{ enabled: boolean }>('/admin/content/translate-enabled');
      setEnabled(data.enabled);
    } catch {
      // 静默处理错误，避免在未登录页面产生控制台错误
    }
  }, []);

  // 切换翻译开关
  const toggle = useCallback(async (checked: boolean) => {
    setLoading(true);
    try {
      await api.put('/admin/content/translate-enabled', { enabled: checked });
      setEnabled(checked);
      message.success(checked ? '翻译功能已开启（全局生效）' : '翻译功能已关闭（全局生效）');
    } catch (err) {
      console.error('切换翻译状态失败:', err);
      message.error('切换翻译状态失败');
    } finally {
      setLoading(false);
    }
  }, []);

  // 初始化时获取状态
  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <TranslateContext.Provider value={{ enabled, loading, toggle, refresh }}>
      {children}
    </TranslateContext.Provider>
  );
};

// Hook 方便使用
export const useTranslate = () => {
  const context = useContext(TranslateContext);
  if (!context) {
    throw new Error('useTranslate must be used within TranslateProvider');
  }
  return context;
};
