'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import {
  ArrowLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Loader2,
  Check,
  KeyRound,
} from 'lucide-react';
import { toast } from 'sonner';
import { useUpdateAiConfig, useAiLocaleSync } from '@/hooks/useAi';
import { useTranslations } from '@/i18n/provider';
import { useLocale } from 'next-intl';

// ── Provider list ────────────────────────────────────────────────

const LLM_PROVIDERS = [
  { key: 'deepseek', label: 'DeepSeek', logo: '/icons/llm/deepseek.png', placeholder: 'sk-...', recommended: true },
  { key: 'openai', label: 'OpenAI', logo: '/icons/llm/openai.png', placeholder: 'sk-...' },
  { key: 'anthropic', label: 'Claude', logo: '/icons/llm/anthropic.png', placeholder: 'sk-ant-...' },
  { key: 'gemini', label: 'Gemini', logo: '/icons/llm/google.png', placeholder: 'AIza...' },
  { key: 'qwen', label: 'Qwen', logo: '/icons/llm/alibaba.png', placeholder: 'sk-...' },
  { key: 'grok', label: 'Grok', logo: '/icons/llm/xai.png', placeholder: 'xai-...' },
  { key: 'kimi', label: 'Kimi', logo: '/icons/llm/moonshot.png', placeholder: 'sk-...' },
] as const;

// ── Main ─────────────────────────────────────────────────────────

export function AiSettingsPage() {
  const t = useTranslations('ai');
  const updateConfig = useUpdateAiConfig();
  const appLocale = useLocale();

  // AI 输出语言自动跟随 App 语言设置
  useAiLocaleSync(appLocale);

  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [showKeyFor, setShowKeyFor] = useState<string | null>(null);
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [keys, setKeys] = useState<Record<string, string>>({
    deepseek: '', openai: '', anthropic: '', gemini: '', qwen: '', grok: '', kimi: '',
  });

  const setKey = (provider: string, value: string) =>
    setKeys((prev) => ({ ...prev, [provider]: value }));

  const handleSave = async (providerKey: string) => {
    const val = keys[providerKey];
    if (!val.trim()) { toast.error(t('settings.enterApiKey')); return; }
    setSavingKey(providerKey);
    try {
      await updateConfig.mutateAsync({ apiKeys: { [providerKey]: val } });
      setSavedKeys((prev) => new Set(prev).add(providerKey));
      toast.success(t('settings.keySaved', { label: LLM_PROVIDERS.find((p) => p.key === providerKey)?.label ?? providerKey }));
    } catch (err) {
      toast.error((err as Error).message || t('settings.saveFailed'));
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F]">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 border-b border-[#1E1E2E] bg-[#0A0A0F] pt-[env(safe-area-inset-top)] [transform:translateZ(0)]">
        <div className="flex h-14 items-center px-4">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-[#1E1E2E]"
            aria-label={t('common.back')}
          >
            <ArrowLeft className="h-5 w-5 text-[#9090A0]" />
          </button>
          <h1 className="flex-1 text-center text-base font-semibold text-[#F8F8FC]">{t('settings.title')}</h1>
          <div className="w-10" />
        </div>
      </div>

      {/* ── Subtitle ────────────────────────────────────────── */}
      <div className="px-4 pb-2 pt-5">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-cyan-400/60" />
          <span className="text-xs text-[#606070]">
            {t('settings.description')}
          </span>
        </div>
      </div>

      {/* ── Provider list ───────────────────────────────────── */}
      <div className="px-4 pt-2">
        <div className="overflow-hidden rounded-2xl border border-[#1E1E2E]/60 bg-[#12121A]/40">
          {LLM_PROVIDERS.map((provider, idx) => {
            const isExpanded = expandedKey === provider.key;
            const isSaved = savedKeys.has(provider.key);
            const isSaving = savingKey === provider.key;
            const isLast = idx === LLM_PROVIDERS.length - 1;

            return (
              <div key={provider.key}>
                {/* Row */}
                <button
                  type="button"
                  onClick={() => setExpandedKey(isExpanded ? null : provider.key)}
                  className={`flex w-full items-center gap-3 px-4 py-3.5 transition-colors active:bg-[#1E1E2E]/20 ${
                    isExpanded ? 'bg-[#1E1E2E]/10' : ''
                  }`}
                >
                  <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#1E1E2E]/40">
                    <Image src={provider.logo} alt={provider.label} width={36} height={36} className="h-full w-full object-contain" priority />
                  </div>
                  <span className="flex-1 text-left text-sm font-medium text-[#F8F8FC]">
                    {provider.label}
                  </span>
                  {'recommended' in provider && provider.recommended && (
                    <span className="rounded-full bg-cyan-500/15 px-2 py-0.5 text-[10px] font-medium text-cyan-400">
                      {t('common.recommended')}
                    </span>
                  )}
                  {isSaved ? (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#10B981]/15">
                      <Check className="h-3.5 w-3.5 text-[#10B981]" />
                    </div>
                  ) : (
                    <ChevronRight className={`h-4 w-4 text-[#404050] transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                  )}
                </button>

                {/* Expanded key input */}
                {isExpanded && (
                  <div className="bg-[#0A0A0F]/40 px-4 pb-4 pt-1">
                    <div className="relative">
                      <input
                        type={showKeyFor === provider.key ? 'text' : 'password'}
                        value={keys[provider.key]}
                        onChange={(e) => setKey(provider.key, e.target.value)}
                        placeholder={provider.placeholder}
                        className="w-full rounded-xl border border-[#1E1E2E] bg-[#1A1A24] px-4 py-2.5 pr-12 text-sm text-[#F8F8FC] placeholder-[#404050] transition-colors focus:border-cyan-500/40 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowKeyFor(showKeyFor === provider.key ? null : provider.key)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#404050] hover:text-[#9090A0]"
                      >
                        {showKeyFor === provider.key ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSave(provider.key)}
                      disabled={isSaving || !keys[provider.key].trim()}
                      className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 py-2.5 text-sm font-medium text-white transition-colors hover:bg-cyan-600 disabled:opacity-30"
                    >
                      {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      <span>{isSaving ? t('common.saving') : t('common.save')}</span>
                    </button>
                  </div>
                )}

                {/* Divider */}
                {!isLast && <div className="mx-4 border-b border-[#1E1E2E]/30" />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
