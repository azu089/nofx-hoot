// 支持的语言列表（10种语言）
export const locales = [
  'zh-CN',  // 简体中文
  'en',     // 英语
  'zh-TW',  // 繁体中文
  'ja',     // 日语
  'ko',     // 韩语
  'ru',     // 俄语
  'vi',     // 越南语
  'id',     // 印尼语
  'th',     // 泰语
  'tr',     // 土耳其语
] as const;
export type Locale = (typeof locales)[number];

// 默认语言
export const defaultLocale: Locale = 'zh-CN';

// 语言显示名称和国旗
export const localeNames: Record<Locale, { name: string; flag: string; nativeName: string }> = {
  'zh-CN': { name: '简体中文', flag: '🇨🇳', nativeName: '简体中文' },
  'en': { name: 'English', flag: '🇺🇸', nativeName: 'English' },
  'zh-TW': { name: '繁體中文', flag: '🇭🇰', nativeName: '繁體中文' },
  'ja': { name: '日本語', flag: '🇯🇵', nativeName: '日本語' },
  'ko': { name: '한국어', flag: '🇰🇷', nativeName: '한국어' },
  'ru': { name: 'Русский', flag: '🇷🇺', nativeName: 'Русский' },
  'vi': { name: 'Tiếng Việt', flag: '🇻🇳', nativeName: 'Tiếng Việt' },
  'id': { name: 'Bahasa Indonesia', flag: '🇮🇩', nativeName: 'Bahasa Indonesia' },
  'th': { name: 'ไทย', flag: '🇹🇭', nativeName: 'ภาษาไทย' },
  'tr': { name: 'Türkçe', flag: '🇹🇷', nativeName: 'Türkçe' },
};

// 语言检测优先级
export const localeDetection = {
  // 从 cookie 读取
  lookupCookie: 'NEXT_LOCALE',
  // 从 localStorage 读取
  lookupLocalStorage: 'locale',
  // 缓存到 cookie（天数）
  cacheUserLanguage: 365,
};
