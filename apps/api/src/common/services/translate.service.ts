/**
 * DeepL 自动翻译服务
 * 支持将中文内容自动翻译为 10 种语言
 */
import { Injectable, Logger } from '@nestjs/common';
import {
  SUPPORTED_LOCALES,
  type Locale,
  type I18nContent,
} from '../utils/i18n.util';

// DeepL 语言代码映射
const DEEPL_LANG_MAP: Record<Locale, string> = {
  'zh-CN': 'ZH', // 源语言
  en: 'EN',
  'zh-HK': 'ZH', // DeepL 不区分简繁体，需要后处理
  ja: 'JA',
  ko: 'KO',
  ru: 'RU',
  vi: 'EN', // DeepL 不支持越南语，先用英语
  id: 'ID',
  th: 'EN', // DeepL 不支持泰语，先用英语
  tr: 'TR',
};

// 需要翻译的目标语言（排除源语言 zh-CN）
const TARGET_LOCALES = SUPPORTED_LOCALES.filter((l) => l !== 'zh-CN');

interface DeepLResponse {
  translations: Array<{
    detected_source_language: string;
    text: string;
  }>;
}

@Injectable()
export class TranslateService {
  private readonly logger = new Logger(TranslateService.name);
  private readonly apiKey: string | undefined;
  private readonly apiUrl: string;

  constructor() {
    this.apiKey = process.env.DEEPL_API_KEY;
    // 免费版使用 api-free.deepl.com，Pro 版使用 api.deepl.com
    this.apiUrl = this.apiKey?.endsWith(':fx')
      ? 'https://api-free.deepl.com/v2/translate'
      : 'https://api.deepl.com/v2/translate';
  }

  /**
   * 检查翻译服务是否可用
   */
  isAvailable(): boolean {
    return !!this.apiKey;
  }

  /**
   * 将中文内容翻译为所有支持的语言
   * @param zhContent - 中文内容
   * @returns I18n 格式的多语言内容
   */
  async translateToAll(zhContent: string): Promise<I18nContent> {
    const result: I18nContent = {
      'zh-CN': zhContent,
    };

    if (!this.apiKey || !zhContent.trim()) {
      this.logger.warn('翻译服务不可用或内容为空，返回仅中文内容');
      return result;
    }

    try {
      // 并发翻译到所有目标语言
      const translations = await Promise.allSettled(
        TARGET_LOCALES.map(async (locale) => {
          const targetLang = DEEPL_LANG_MAP[locale];
          if (!targetLang || targetLang === 'ZH') {
            // 繁体中文特殊处理
            if (locale === 'zh-HK') {
              return { locale, text: this.convertToTraditional(zhContent) };
            }
            return null;
          }

          const translated = await this.translate(zhContent, 'ZH', targetLang);
          return { locale, text: translated };
        }),
      );

      // 处理翻译结果
      for (const res of translations) {
        if (res.status === 'fulfilled' && res.value) {
          result[res.value.locale] = res.value.text;
        } else if (res.status === 'rejected') {
          this.logger.warn(`翻译失败: ${res.reason}`);
        }
      }

      this.logger.log(`翻译完成: ${Object.keys(result).length} 种语言`);
    } catch (error) {
      this.logger.error(`批量翻译失败: ${(error as Error).message}`);
    }

    return result;
  }

  /**
   * 翻译单条内容
   */
  private async translate(
    text: string,
    sourceLang: string,
    targetLang: string,
  ): Promise<string> {
    if (!this.apiKey) {
      throw new Error('DeepL API Key 未配置');
    }

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `DeepL-Auth-Key ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: [text],
        source_lang: sourceLang,
        target_lang: targetLang,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DeepL API 错误 (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as DeepLResponse;
    return data.translations[0]?.text || text;
  }

  /**
   * 简体转繁体（简单映射，实际项目可用 opencc 库）
   */
  private convertToTraditional(simplified: string): string {
    // 常用简繁体映射表（无重复键）
    const map: Record<string, string> = {
      发: '發',
      开: '開',
      关: '關',
      语: '語',
      时: '時',
      间: '間',
      动: '動',
      态: '態',
      内: '內',
      设: '設',
      统: '統',
      维: '維',
      护: '護',
      户: '戶',
      录: '錄',
      注: '註',
      册: '冊',
      资: '資',
      产: '產',
      订: '訂',
      阅: '閱',
      钱: '錢',
      体: '體',
      验: '驗',
      台: '臺',
      线: '線',
      周: '週',
      点: '點',
      进: '進',
      测: '測',
      踪: '蹤',
      趋: '趨',
      势: '勢',
      风: '風',
      险: '險',
      确: '確',
      认: '認',
      编: '編',
      辑: '輯',
      删: '刪',
      选: '選',
      择: '擇',
      显: '顯',
      隐: '隱',
      启: '啟',
      暂: '暫',
      继: '繼',
      续: '續',
      执: '執',
      败: '敗',
      错: '錯',
      误: '誤',
      邮: '郵',
      码: '碼',
      证: '證',
      绑: '綁',
      锁: '鎖',
      帮: '幫',
      联: '聯',
      问: '問',
      题: '題',
      说: '說',
      欢: '歡',
      谢: '謝',
      请: '請',
      输: '輸',
      数: '數',
      据: '據',
      图: '圖',
      报: '報',
      单: '單',
      总: '總',
      计: '計',
      详: '詳',
      细: '細',
      历: '歷',
      记: '記',
      级: '級',
      别: '別',
      状: '狀',
      权: '權',
      限: '限',
    };

    let result = simplified;
    for (const [s, t] of Object.entries(map)) {
      result = result.replace(new RegExp(s, 'g'), t);
    }
    return result;
  }

  /**
   * 获取 API 使用情况
   */
  async getUsage(): Promise<{
    character_count: number;
    character_limit: number;
  } | null> {
    if (!this.apiKey) return null;

    try {
      const usageUrl = this.apiKey.endsWith(':fx')
        ? 'https://api-free.deepl.com/v2/usage'
        : 'https://api.deepl.com/v2/usage';

      const response = await fetch(usageUrl, {
        headers: {
          Authorization: `DeepL-Auth-Key ${this.apiKey}`,
        },
      });

      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      this.logger.error(`获取 DeepL 使用情况失败: ${(error as Error).message}`);
    }
    return null;
  }
}
