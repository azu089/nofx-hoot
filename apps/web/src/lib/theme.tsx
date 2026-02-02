'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

type Theme = 'light' | 'dark' | 'system';
type EffectiveTheme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  effectiveTheme: EffectiveTheme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

const STORAGE_KEY = 'hoot_theme';

// 获取系统偏好
function getSystemTheme(): EffectiveTheme {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// 应用主题到 DOM
function applyThemeToDOM(effective: EffectiveTheme) {
  const root = document.documentElement;
  if (effective === 'dark') {
    root.classList.add('dark');
    root.classList.remove('light');
  } else {
    root.classList.remove('dark');
    root.classList.add('light');
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark');
  const [effectiveTheme, setEffectiveTheme] = useState<EffectiveTheme>('dark');
  const [mounted, setMounted] = useState(false);

  // 应用主题
  const applyTheme = useCallback((effective: EffectiveTheme) => {
    applyThemeToDOM(effective);
    setEffectiveTheme(effective);
  }, []);

  // 初始化 - 从 localStorage 读取
  // eslint-disable-next-line react-hooks/set-state-in-effect -- 从 localStorage 初始化主题是合理的一次性副作用
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    const initial = stored || 'dark';
    setThemeState(initial);

    const effective = initial === 'system' ? getSystemTheme() : initial;
    applyTheme(effective);
    setMounted(true);
  }, [applyTheme]);

  // 监听系统主题变化（仅当选择"系统"时）
  useEffect(() => {
    if (theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      applyTheme(e.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [theme, applyTheme]);

  // 设置主题
  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem(STORAGE_KEY, newTheme);

    const effective = newTheme === 'system' ? getSystemTheme() : newTheme;
    applyTheme(effective);
  }, [applyTheme]);

  // 防止服务端渲染闪烁 - 返回占位符
  if (!mounted) {
    return (
      <div className="min-h-screen bg-[#0A0A0F]">
        {/* 加载占位符，防止闪烁 */}
      </div>
    );
  }

  return (
    <ThemeContext.Provider value={{ theme, effectiveTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
