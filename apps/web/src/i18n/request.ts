import { getRequestConfig } from 'next-intl/server';
import { cookies, headers } from 'next/headers';
import { locales, defaultLocale, type Locale } from './config';

export default getRequestConfig(async () => {
  // 1. 首先从 cookie 读取
  const cookieStore = await cookies();
  let locale = cookieStore.get('NEXT_LOCALE')?.value as Locale | undefined;

  // 2. 如果 cookie 没有，从 Accept-Language header 读取
  if (!locale) {
    const headerStore = await headers();
    const acceptLanguage = headerStore.get('accept-language');
    if (acceptLanguage) {
      // 解析 Accept-Language header
      const browserLocales = acceptLanguage
        .split(',')
        .map((lang) => lang.split(';')[0].trim());

      // 找到第一个匹配的语言
      for (const browserLocale of browserLocales) {
        // 精确匹配
        if (locales.includes(browserLocale as Locale)) {
          locale = browserLocale as Locale;
          break;
        }
        // 模糊匹配（如 zh -> zh-CN）
        const langPrefix = browserLocale.split('-')[0];
        const matched = locales.find((l) => l.startsWith(langPrefix));
        if (matched) {
          locale = matched;
          break;
        }
      }
    }
  }

  // 3. 使用默认语言
  if (!locale || !locales.includes(locale)) {
    locale = defaultLocale;
  }

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
