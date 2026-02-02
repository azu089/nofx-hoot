/**
 * 多语言内容工具
 * 支持 10 种语言：zh-CN, en, zh-HK, ja, ko, ru, vi, id, th, tr
 */

// 支持的语言列表
export const SUPPORTED_LOCALES = [
  'zh-CN', // 简体中文（默认）
  'en', // English
  'zh-HK', // 繁體中文
  'ja', // 日本語
  'ko', // 한국어
  'ru', // Русский
  'vi', // Tiếng Việt
  'id', // Bahasa Indonesia
  'th', // ไทย
  'tr', // Türkçe
] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'zh-CN';

// 语言名称映射
export const LOCALE_NAMES: Record<Locale, string> = {
  'zh-CN': '简体中文',
  en: 'English',
  'zh-HK': '繁體中文',
  ja: '日本語',
  ko: '한국어',
  ru: 'Русский',
  vi: 'Tiếng Việt',
  id: 'Bahasa Indonesia',
  th: 'ไทย',
  tr: 'Türkçe',
};

// I18n 内容类型
export type I18nContent = Partial<Record<Locale, string>>;
export type I18nArrayContent = Partial<Record<Locale, string[]>>;

/**
 * 从 I18n JSON 中获取指定语言的内容
 * @param i18nJson - I18n JSON 对象
 * @param locale - 目标语言
 * @param fallback - 后备内容（如果所有语言都没有）
 */
export function getLocalizedContent(
  i18nJson: I18nContent | null | undefined,
  locale: string,
  fallback = '',
): string {
  if (!i18nJson || typeof i18nJson !== 'object') {
    return fallback;
  }

  // 尝试获取目标语言
  const targetLocale = locale as Locale;
  if (i18nJson[targetLocale]) {
    return i18nJson[targetLocale];
  }

  // 尝试获取默认语言
  if (i18nJson[DEFAULT_LOCALE]) {
    return i18nJson[DEFAULT_LOCALE];
  }

  // 尝试获取英文
  if (i18nJson['en']) {
    return i18nJson['en'];
  }

  // 返回任意有内容的语言
  for (const l of SUPPORTED_LOCALES) {
    if (i18nJson[l]) {
      return i18nJson[l];
    }
  }

  return fallback;
}

/**
 * 从 I18n JSON 中获取指定语言的数组内容
 */
export function getLocalizedArrayContent(
  i18nJson: I18nArrayContent | null | undefined,
  locale: string,
  fallback: string[] = [],
): string[] {
  if (!i18nJson || typeof i18nJson !== 'object') {
    return fallback;
  }

  const targetLocale = locale as Locale;
  if (i18nJson[targetLocale]) {
    return i18nJson[targetLocale];
  }

  if (i18nJson[DEFAULT_LOCALE]) {
    return i18nJson[DEFAULT_LOCALE];
  }

  if (i18nJson['en']) {
    return i18nJson['en'];
  }

  for (const l of SUPPORTED_LOCALES) {
    if (i18nJson[l]) {
      return i18nJson[l];
    }
  }

  return fallback;
}

/**
 * 构建 I18n JSON 对象
 * @param content - 内容映射
 */
export function buildI18nContent(
  content: Partial<Record<Locale, string>>,
): I18nContent {
  const result: I18nContent = {};
  for (const [locale, value] of Object.entries(content)) {
    if (value && SUPPORTED_LOCALES.includes(locale as Locale)) {
      result[locale as Locale] = value;
    }
  }
  return result;
}

/**
 * 验证语言是否支持
 */
export function isValidLocale(locale: string): locale is Locale {
  return SUPPORTED_LOCALES.includes(locale as Locale);
}

/**
 * 获取有效的语言，如果不支持则返回默认语言
 */
export function getValidLocale(locale: string | undefined | null): Locale {
  if (locale && isValidLocale(locale)) {
    return locale;
  }
  return DEFAULT_LOCALE;
}

/**
 * 将单语言内容转换为 I18n 格式
 * 用于数据迁移
 */
export function migrateToI18n(
  zhContent: string | null | undefined,
  enContent: string | null | undefined,
): I18nContent {
  const result: I18nContent = {};
  if (zhContent) {
    result['zh-CN'] = zhContent;
  }
  if (enContent) {
    result['en'] = enContent;
  }
  return result;
}

/**
 * 本地化实体对象
 * 将实体中的 I18n 字段转换为指定语言的值
 */
export function localizeEntity<T extends Record<string, unknown>>(
  entity: T,
  locale: string,
  i18nFields: {
    sourceField: string;
    targetField: string;
    fallbackField?: string;
  }[],
): T {
  const result = { ...entity };

  for (const { sourceField, targetField, fallbackField } of i18nFields) {
    const i18nJson = entity[sourceField] as I18nContent | null;
    const fallback = fallbackField
      ? (entity[fallbackField] as string) || ''
      : '';
    (result as Record<string, unknown>)[targetField] = getLocalizedContent(
      i18nJson,
      locale,
      fallback,
    );
  }

  return result;
}
