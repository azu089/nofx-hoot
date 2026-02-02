// Re-export configuration
export { locales, defaultLocale, localeNames, type Locale } from './config';

// Helper function to get messages for a locale (for server components)
export async function getMessages(locale: string) {
  try {
    return (await import(`./messages/${locale}.json`)).default;
  } catch {
    return (await import('./messages/zh-CN.json')).default;
  }
}
