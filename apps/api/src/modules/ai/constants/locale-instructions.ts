/**
 * 动态语言指令构建器
 *
 * 根据用户 locale 设置生成 LLM Prompt 的语言指令，
 * 替代硬编码的 "MUST be in Chinese" 等固定文本。
 *
 * 支持的 locale: zh-CN, zh-TW, en, ko, ja, ru, th, tr, vi, id
 */

// locale → 语言名称映射（供 prompt 注入）
const LOCALE_NAMES: Record<string, { english: string; native: string }> = {
  'zh-CN': { english: 'Chinese (Simplified)', native: '简体中文' },
  'zh-TW': { english: 'Chinese (Traditional)', native: '繁體中文' },
  'en': { english: 'English', native: 'English' },
  'ko': { english: 'Korean', native: '한국어' },
  'ja': { english: 'Japanese', native: '日本語' },
  'ru': { english: 'Russian', native: 'Русский' },
  'th': { english: 'Thai', native: 'ภาษาไทย' },
  'tr': { english: 'Turkish', native: 'Türkçe' },
  'vi': { english: 'Vietnamese', native: 'Tiếng Việt' },
  'id': { english: 'Indonesian', native: 'Bahasa Indonesia' },
};

/**
 * 获取 locale 对应的语言名称
 */
export function getLanguageName(locale: string): { english: string; native: string } {
  return LOCALE_NAMES[locale] || LOCALE_NAMES['en'];
}

/**
 * 构建 Prompt 内语言指令段落
 *
 * 用于注入 System Prompt 末尾，告知 LLM 使用指定语言输出 reasoning 等文本字段
 *
 * @param locale 用户 locale (e.g. "zh-CN", "en", "ko")
 * @returns 一段 Prompt 文本
 */
export function buildLanguageInstruction(locale?: string): string {
  const lang = getLanguageName(locale || 'zh-CN');

  // 英文不需要特殊指令，LLM 默认英文
  if (locale === 'en') {
    return `## Language
All "reasoning", "keyPoints", and textual analysis fields should be written in English. JSON keys and action values remain in English.`;
  }

  return `## Language
All "reasoning", "keyPoints", and textual analysis fields MUST be written in ${lang.english} (${lang.native}). JSON keys and action values remain in English.`;
}

/**
 * 构建投票格式中 reasoning 字段的语言提示
 *
 * @param locale 用户 locale
 * @returns e.g. "(MUST be in Chinese 中文)" or "(MUST be in Korean 한국어)"
 */
export function buildReasoningLanguageHint(locale?: string): string {
  const lang = getLanguageName(locale || 'zh-CN');
  if (locale === 'en') return '';
  return `(MUST be in ${lang.english} ${lang.native})`;
}

/**
 * 构建 user message 末尾的语言提醒
 *
 * 当 prompt 上下文大量英文时，system prompt 末尾的语言指令容易被 LLM 忽略。
 * 在 user message 结尾追加此提醒可显著提高语言遵循率。
 *
 * @param locale 用户 locale
 * @returns e.g. "\n\n[IMPORTANT: Write your response in Chinese (简体中文)]"
 */
export function buildUserMessageLanguageReminder(locale?: string): string {
  const lang = getLanguageName(locale || 'zh-CN');
  if (locale === 'en') return '';
  return `\n\n[IMPORTANT: Write your entire response in ${lang.english} (${lang.native}). Do NOT write in English.]`;
}
