'use client';

import Script from 'next/script';
import { useEffect, useState } from 'react';

/**
 * 仅在 Telegram Mini App 环境中加载 TG WebApp SDK。
 * 检测方式：URL hash 或 search 参数中包含 tgWebAppData。
 * 非 TG 环境不发起请求，避免 ERR_TUNNEL_CONNECTION_FAILED 控制台错误。
 */
export function TelegramScript() {
  const [isTg, setIsTg] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;
    const search = window.location.search;
    if (hash.includes('tgWebAppData') || search.includes('tgWebAppData')) {
      setIsTg(true);
    }
  }, []);

  if (!isTg) return null;

  return (
    <Script
      src="https://telegram.org/js/telegram-web-app.js"
      strategy="afterInteractive"
    />
  );
}
