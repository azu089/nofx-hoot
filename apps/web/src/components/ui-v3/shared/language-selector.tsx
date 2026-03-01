'use client';

import { useState, useRef, useEffect } from 'react';
import { Globe, ChevronDown, Check } from 'lucide-react';
import { useLocale } from '@/i18n/provider';
import { locales, localeNames, type Locale } from '@/i18n/config';

export function LanguageSelector({ className = '' }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { locale, setLocale } = useLocale();

  const languages = locales.map((code) => ({
    code,
    name: localeNames[code].nativeName,
    flag: localeNames[code].flag,
  }));

  // 点击外部关闭
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleSelect = (code: Locale) => {
    setLocale(code);
    setOpen(false);
  };

  const current = localeNames[locale];

  return (
    <div dir="ltr" ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#1A1A24]/80 backdrop-blur-sm border border-[#1E1E2E] hover:bg-[#2A2A3A] rounded-lg transition-colors"
        aria-label="切换语言"
      >
        <Globe className="w-4 h-4 text-[#94A3B8]" />
        <span className="text-base leading-none">{current.flag}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-[#94A3B8] transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-44 max-h-[280px] overflow-y-auto bg-[#1A1A24] border border-[#1E1E2E] rounded-lg shadow-xl z-[100]">
          {languages.map((lang) => (
            <button
              key={lang.code}
              type="button"
              onClick={() => handleSelect(lang.code)}
              className={`w-full px-3 py-2.5 text-left text-sm hover:bg-[#2A2A3A] transition-colors flex items-center gap-2 ${
                locale === lang.code
                  ? 'text-[#06B6D4] bg-[#06B6D4]/10'
                  : 'text-white'
              }`}
            >
              <span className="text-base">{lang.flag}</span>
              <span className="flex-1 truncate">{lang.name}</span>
              {locale === lang.code && (
                <Check className="w-4 h-4 flex-shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
