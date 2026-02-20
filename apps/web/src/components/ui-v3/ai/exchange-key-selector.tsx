'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ChevronDown, Check, ChevronRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useTranslations } from 'next-intl';

// ── Exchange helpers ──────────────────────────────────────────

const supportedExchanges = [
  { id: 'binance', name: 'Binance', logo: '/icons/exchanges/币安.webp' },
  { id: 'okx', name: 'OKX', logo: '/icons/exchanges/okx.webp' },
  { id: 'bybit', name: 'Bybit', logo: '/icons/exchanges/bybit.webp' },
  { id: 'gate', name: 'Gate.io', logo: '/icons/exchanges/gate.webp' },
  { id: 'bitget', name: 'Bitget', logo: '/icons/exchanges/bitget.webp' },
  { id: 'coinbase', name: 'Coinbase', logo: '/icons/exchanges/coinbase.webp' },
  { id: 'hyperliquid', name: 'Hyperliquid', logo: '/icons/exchanges/hyperliquid.webp' },
  { id: 'aster', name: 'Aster DEX', logo: '/icons/exchanges/aster-dex.webp' },
  { id: 'lighter', name: 'Lighter', logo: '/icons/exchanges/lighter.webp' },
];

const getExchangeLogo = (exchange: string) =>
  supportedExchanges.find((e) => e.id === exchange)?.logo || '/icons/exchanges/default.webp';

const getExchangeName = (exchange: string) =>
  supportedExchanges.find((e) => e.id === exchange)?.name || exchange;

interface ApiKeyItem {
  id: string;
  exchange: string;
  label: string;
  maskedKey: string;
  isActive: boolean;
  createdAt: string;
  authType?: 'api_key' | 'wallet';
}

// ── Shared hook ─────────────────────────────────────────────

export function useApiKeys() {
  return useQuery({
    queryKey: ['api-keys'],
    queryFn: async () => {
      const res = await api.get<{ items: ApiKeyItem[]; total: number }>('/api-keys');
      return res.data?.items || [];
    },
    staleTime: 60000,
  });
}

// ── Component ───────────────────────────────────────────────

interface ExchangeKeySelectorProps {
  value: string | null;
  onChange: (id: string | null) => void;
  label?: string;
}

export function ExchangeKeySelector({ value, onChange, label }: ExchangeKeySelectorProps) {
  const t = useTranslations('ai');
  const displayLabel = label || t('create.exchangeAccount');
  const [open, setOpen] = useState(false);
  const { data: apiKeys } = useApiKeys();

  const selected = apiKeys?.find((k) => k.id === value);

  if (!apiKeys || apiKeys.length === 0) {
    return (
      <div className="space-y-2">
        <label className="block text-sm font-medium text-[#9090A0]">{displayLabel}</label>
        <button
          type="button"
          onClick={() => { window.location.href = '/wallet/api-keys'; }}
          className="flex w-full items-center justify-between rounded-xl bg-[#1E1E2E] border border-[#1E1E2E] px-4 py-3 transition-colors hover:border-cyan-500/50"
        >
          <span className="text-sm text-[#606070]">{t('create.notBoundExchange')}</span>
          <div className="flex items-center gap-1 text-xs text-cyan-400">
            <span>{t('create.goToBind')}</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </div>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-[#9090A0]">{displayLabel}</label>
      <div className="relative">
        {/* Trigger */}
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex w-full items-center gap-3 rounded-xl bg-[#1E1E2E] border border-[#1E1E2E] px-4 py-3 transition-colors hover:border-cyan-500/50"
        >
          {selected ? (
            <>
              <div className="relative h-6 w-6 shrink-0 overflow-hidden rounded-md bg-[#12121A]">
                <Image src={getExchangeLogo(selected.exchange)} alt={selected.exchange} fill className="object-cover" />
              </div>
              <div className="flex-1 text-left">
                <span className="text-sm font-medium text-[#F8F8FC]">{selected.label}</span>
                <span className="ml-2 text-xs text-[#606070]">{getExchangeName(selected.exchange)}</span>
              </div>
            </>
          ) : (
            <span className="flex-1 text-left text-sm text-[#606070]">{t('create.selectExchangeAccount')}</span>
          )}
          <div className="flex items-center gap-2">
            {selected && <div className={`h-2 w-2 rounded-full ${selected.isActive ? 'bg-[#10B981]' : 'bg-[#606070]'}`} />}
            <ChevronDown className={`h-4 w-4 text-[#606070] transition-transform ${open ? 'rotate-180' : ''}`} />
          </div>
        </button>

        {/* Dropdown */}
        {open && (
          <div className="absolute left-0 right-0 bottom-full z-50 mb-1 max-h-60 overflow-y-auto rounded-xl border border-[#1E1E2E] bg-[#12121A] shadow-xl">
            {apiKeys.map((item) => {
              const isSelected = item.id === value;
              const isDex = item.authType === 'wallet';
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => { onChange(item.id); setOpen(false); }}
                  className={`flex w-full items-center gap-3 px-4 py-3 transition-colors hover:bg-[#1E1E2E]/50 ${isSelected ? 'bg-cyan-500/5' : ''}`}
                >
                  <div className="relative h-6 w-6 shrink-0 overflow-hidden rounded-md bg-[#1E1E2E]">
                    <Image src={getExchangeLogo(item.exchange)} alt={item.exchange} fill className="object-cover" />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-[#F8F8FC]">{item.label}</span>
                      {isDex && (
                        <span className="rounded bg-purple-500/20 px-1.5 py-0.5 text-[10px] text-purple-400">DEX</span>
                      )}
                    </div>
                    <span className="text-xs text-[#606070]">{getExchangeName(item.exchange)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${item.isActive ? 'bg-[#10B981]' : 'bg-[#606070]'}`} />
                    {isSelected && <Check className="h-4 w-4 text-cyan-400" />}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
