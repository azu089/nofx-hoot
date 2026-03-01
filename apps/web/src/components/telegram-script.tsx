import Script from 'next/script';

/**
 * 无条件加载 Telegram WebApp SDK。
 * 使用 beforeInteractive 确保脚本在 React 水合前执行，
 * 使 window.Telegram.WebApp（含 initData）在任何 JS 代码运行前就绪。
 *
 * 覆盖所有平台：
 *   - Telegram Web (web.telegram.org)：脚本从 URL hash 中解析 initData
 *   - Native Telegram（iOS / Android / macOS）：脚本通过 native bridge 获取 initData
 *
 * 注意：非 TG 环境下 window.Telegram.WebApp.initData 为空字符串，
 * auth.tsx 会检测到空值并跳过自动登录，无副作用。
 */
export function TelegramScript() {
  return (
    <Script
      src="https://telegram.org/js/telegram-web-app.js"
      strategy="beforeInteractive"
    />
  );
}
