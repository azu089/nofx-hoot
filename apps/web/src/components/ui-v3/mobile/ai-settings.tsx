'use client';

import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Save,
  Key,
  Brain,
  DollarSign,
  Shield,
  BarChart3,
  Link,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useAiConfig, useUpdateAiConfig, useAiBudget, useAiPerformance } from '@/hooks/useAi';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function ToggleSwitch({ checked, onChange }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        checked ? 'bg-cyan-500' : 'bg-gray-600'
      }`}
      role="switch"
      aria-checked={checked}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

interface CustomSelectProps {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  label: string;
}

function CustomSelect({ value, options, onChange, label }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <label className="mb-2 block text-sm text-[#94A3B8]">{label}</label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between rounded-lg border border-[#1E1E2E] bg-[#1E1E2E] px-4 py-3 text-left text-[#F8F8FC] transition-colors hover:border-cyan-400 focus:border-cyan-400 focus:outline-none"
      >
        <span>{value}</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="absolute z-10 mt-1 w-full rounded-lg border border-[#1E1E2E] bg-[#12121A] shadow-lg">
          {options.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                onChange(option);
                setIsOpen(false);
              }}
              className={`w-full px-4 py-3 text-left transition-colors hover:bg-[#1E1E2E] ${
                value === option ? 'text-cyan-400' : 'text-[#F8F8FC]'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface PasswordInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  badge?: string;
}

function PasswordInput({ label, value, onChange, placeholder, badge }: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className="text-sm text-[#94A3B8]">{label}</label>
        {badge && (
          <span className="rounded bg-cyan-500/20 px-2 py-0.5 text-xs text-cyan-400">
            {badge}
          </span>
        )}
      </div>
      <div className="relative">
        <input
          type={showPassword ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-[#1E1E2E] bg-[#1E1E2E] px-4 py-3 pr-12 text-[#F8F8FC] placeholder-[#64748B] transition-colors focus:border-cyan-400 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#94A3B8]"
        >
          {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </button>
      </div>
    </div>
  );
}

interface AccordionProps {
  title: string;
  summary: React.ReactNode;
  icon: React.ReactNode;
  children: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
}

function Accordion({ title, summary, icon, children, isOpen, onToggle }: AccordionProps) {
  return (
    <div className="rounded-lg border border-[#1E1E2E] bg-[#12121A]">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-[#1E1E2E]/50"
      >
        <div className="mt-0.5 text-cyan-400">{icon}</div>
        <div className="flex-1">
          <div className="mb-1 font-medium text-[#F8F8FC]">{title}</div>
          <div className="text-sm text-[#94A3B8]">{summary}</div>
        </div>
        {isOpen ? (
          <ChevronDown className="mt-1 h-5 w-5 text-[#64748B]" />
        ) : (
          <ChevronRight className="mt-1 h-5 w-5 text-[#64748B]" />
        )}
      </button>
      {isOpen && (
        <div className="border-t border-[#1E1E2E] p-4">
          {children}
        </div>
      )}
    </div>
  );
}

interface ApiKeyResponse {
  id: string;
  exchange: string;
  label: string;
  maskedKey: string;
  isActive: boolean;
  createdAt: string;
  authType?: 'api_key' | 'wallet';
  walletAddress?: string;
}

export function AiSettingsPage() {
  // API hooks
  const { data: config, isLoading: configLoading } = useAiConfig();
  const { data: budget } = useAiBudget();
  const { data: performance } = useAiPerformance();
  const updateConfig = useUpdateAiConfig();

  // Fetch API keys to display in exchange binding section
  const { data: apiKeysData } = useQuery({
    queryKey: ['api-keys'],
    queryFn: async () => {
      const response = await api.get<{ items: ApiKeyResponse[]; total: number }>('/api-keys');
      return response.data?.items || [];
    },
  });

  // UI state
  const [accordion1Open, setAccordion1Open] = useState(false);
  const [accordion2Open, setAccordion2Open] = useState(false);
  const [accordion3Open, setAccordion3Open] = useState(false);
  const [accordion4Open, setAccordion4Open] = useState(false);
  const [accordion5Open, setAccordion5Open] = useState(false);

  // LLM API Keys (input-only, never returned from API)
  const [deepseekKey, setDeepseekKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [openrouterKey, setOpenrouterKey] = useState('');
  const [qwenKey, setQwenKey] = useState('');
  const [grokKey, setGrokKey] = useState('');
  const [kimiKey, setKimiKey] = useState('');

  // Local form state (synced from API)
  const [aiTradingEnabled, setAiTradingEnabled] = useState(false);
  const [fastModel, setFastModel] = useState('deepseek-chat');
  const [deepModel, setDeepModel] = useState('deepseek-chat');
  const [llmBudget, setLlmBudget] = useState('10');
  const [aiFundPool, setAiFundPool] = useState('1000');
  const [maxSingleTrade, setMaxSingleTrade] = useState('100');
  const [maxDailyLoss, setMaxDailyLoss] = useState('200');

  const modelOptions = [
    'deepseek-chat',
    'gpt-4o-mini',
    'claude-3-5-haiku',
    'gemini-2.0-flash',
    'qwen-plus',
    'grok-2',
    'moonshot-v1-8k',
  ];

  // Sync API data to local form state
  // This is a valid pattern for syncing server state to form state
  /* eslint-disable */
  useEffect(() => {
    if (config) {
      setAiTradingEnabled(config.isEnabled);
      setFastModel((config.models as string[])?.[0] || 'deepseek-chat');
      setDeepModel((config.models as string[])?.[1] || 'deepseek-chat');
      setAiFundPool(String(config.amountPerTrade || 1000));
      setMaxSingleTrade(String(config.maxPositionSize || 100));
      setMaxDailyLoss(String(config.maxDailyDrawdown || 200));
    }
  }, [config]);

  useEffect(() => {
    if (budget) {
      setLlmBudget(String(budget.monthlyBudget || 10));
    }
  }, [budget]);
  /* eslint-enable */

  // Calculate budget metrics from API data
  const llmSpent = budget?.currentSpend ?? 0;
  const budgetPercentage = budget?.usagePercent ?? 0;
  const progressBarColor =
    budgetPercentage < 70
      ? 'bg-green-400'
      : budgetPercentage < 90
      ? 'bg-yellow-400'
      : 'bg-red-400';

  // Map performance data
  const modelPerformance = (performance?.modelRankings || []).map(m => ({
    name: m.modelId,
    trades: m.totalAnalyses,
    winRate: Math.round(m.successRate * 100),
    sharpe: m.sharpe,
    tier: m.tier,
  }));

  const handleSave = async () => {
    try {
      const apiKeysPayload: Record<string, string> = {};
      if (deepseekKey) apiKeysPayload.deepseek = deepseekKey;
      if (openaiKey) apiKeysPayload.openai = openaiKey;
      if (openrouterKey) apiKeysPayload.openrouter = openrouterKey;
      if (qwenKey) apiKeysPayload.qwen = qwenKey;
      if (grokKey) apiKeysPayload.grok = grokKey;
      if (kimiKey) apiKeysPayload.kimi = kimiKey;

      await updateConfig.mutateAsync({
        isEnabled: aiTradingEnabled,
        models: [fastModel, deepModel],
        monthlyBudget: parseFloat(llmBudget) || 10,
        amountPerTrade: parseFloat(aiFundPool) || 1000,
        maxPositionSize: parseFloat(maxSingleTrade) || 100,
        maxDailyDrawdown: parseFloat(maxDailyLoss) || 200,
        ...(Object.keys(apiKeysPayload).length > 0 && { apiKeys: apiKeysPayload }),
      });
      alert('设置已保存');
    } catch (err) {
      const error = err as Error;
      alert(error.message || '保存失败');
    }
  };

  if (configLoading) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
        <div className="text-[#94A3B8]">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] pb-24">
      {/* Top bar */}
      <div className="sticky top-0 z-10 border-b border-[#1E1E2E] bg-[#0A0A0F]/95 backdrop-blur">
        <div className="flex items-center gap-3 px-4 py-4">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="text-[#94A3B8] hover:text-[#F8F8FC]"
            aria-label="返回"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h1 className="text-lg font-semibold text-[#F8F8FC]">AI 设置</h1>
        </div>
      </div>

      <div className="space-y-4 p-4">
        {/* AI Trading master switch */}
        <div className="rounded-lg border border-[#1E1E2E] bg-[#12121A] p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="mb-1 font-medium text-[#F8F8FC]">AI 交易总开关</div>
              <div className="text-sm text-[#94A3B8]">
                开启后 AI 可使用你的 API Key 交易
              </div>
            </div>
            <ToggleSwitch checked={aiTradingEnabled} onChange={setAiTradingEnabled} />
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-[#1E1E2E]" />

        {/* Accordion 1: LLM API Keys */}
        <Accordion
          title="LLM API Keys"
          summary={
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {[
                { label: 'DeepSeek', active: !!deepseekKey },
                { label: 'OpenAI', active: !!openaiKey },
                { label: 'OR', active: !!openrouterKey },
                { label: 'Qwen', active: !!qwenKey },
                { label: 'Grok', active: !!grokKey },
                { label: 'Kimi', active: !!kimiKey },
              ].map((item, i) => (
                <span key={item.label} className="inline-flex items-center gap-1">
                  {i > 0 && <span className="text-[#64748B] mr-1">·</span>}
                  <span className={item.active ? 'text-white' : 'text-[#64748B]'}>{item.label}</span>
                  <span className={`h-2 w-2 rounded-full ${item.active ? 'bg-green-400 shadow-[0_0_4px_rgba(74,222,128,0.5)]' : 'bg-red-500/60'}`} />
                </span>
              ))}
            </div>
          }
          icon={<Key className="h-5 w-5" />}
          isOpen={accordion1Open}
          onToggle={() => setAccordion1Open(!accordion1Open)}
        >
          <div className="space-y-4">
            <PasswordInput
              label="DeepSeek API Key"
              value={deepseekKey}
              onChange={setDeepseekKey}
              placeholder="sk-..."
              badge="推荐"
            />
            <PasswordInput
              label="OpenAI API Key"
              value={openaiKey}
              onChange={setOpenaiKey}
              placeholder="sk-..."
            />
            <PasswordInput
              label="OpenRouter API Key"
              value={openrouterKey}
              onChange={setOpenrouterKey}
              placeholder="sk-or-..."
            />
            <PasswordInput
              label="Qwen (通义千问) API Key"
              value={qwenKey}
              onChange={setQwenKey}
              placeholder="sk-..."
            />
            <PasswordInput
              label="Grok (xAI) API Key"
              value={grokKey}
              onChange={setGrokKey}
              placeholder="xai-..."
            />
            <PasswordInput
              label="Kimi (Moonshot) API Key"
              value={kimiKey}
              onChange={setKimiKey}
              placeholder="sk-..."
            />
            <div className="rounded-lg bg-cyan-500/10 p-3 text-sm text-cyan-400">
              不填则使用平台默认 Key（如已配置）
            </div>
          </div>
        </Accordion>

        {/* Accordion 2: 模型选择 */}
        <Accordion
          title="模型选择"
          summary={
            <div>
              快速: {fastModel} · 深度: {deepModel}
            </div>
          }
          icon={<Brain className="h-5 w-5" />}
          isOpen={accordion2Open}
          onToggle={() => setAccordion2Open(!accordion2Open)}
        >
          <div className="space-y-4">
            <CustomSelect
              label="快速分析模型"
              value={fastModel}
              options={modelOptions}
              onChange={setFastModel}
            />
            <CustomSelect
              label="深度思考模型"
              value={deepModel}
              options={modelOptions}
              onChange={setDeepModel}
            />
          </div>
        </Accordion>

        {/* Accordion 3: 预算与风控 */}
        <Accordion
          title="预算与风控"
          summary={
            <div className="w-full space-y-2">
              <div>
                LLM 预算: ${llmSpent.toFixed(2)} / ${parseFloat(llmBudget).toFixed(2)} (
                {budgetPercentage.toFixed(1)}%)
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#1E1E2E]">
                <div
                  className={`h-full ${progressBarColor} transition-all`}
                  style={{ width: `${Math.min(budgetPercentage, 100)}%` }}
                />
              </div>
            </div>
          }
          icon={<DollarSign className="h-5 w-5" />}
          isOpen={accordion3Open}
          onToggle={() => setAccordion3Open(!accordion3Open)}
        >
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm text-[#94A3B8]">月度 LLM 预算 ($)</label>
              <input
                type="number"
                value={llmBudget}
                onChange={(e) => setLlmBudget(e.target.value)}
                className="w-full rounded-lg border border-[#1E1E2E] bg-[#1E1E2E] px-4 py-3 text-[#F8F8FC] placeholder-[#64748B] transition-colors focus:border-cyan-400 focus:outline-none"
              />
            </div>

            <div>
              <div className="mb-2 text-sm text-[#94A3B8]">当前消耗</div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-[#1E1E2E]">
                <div
                  className={`h-full ${progressBarColor} transition-all`}
                  style={{ width: `${Math.min(budgetPercentage, 100)}%` }}
                />
              </div>
              <div className="mt-1 text-right text-xs text-[#64748B]">
                {budgetPercentage.toFixed(1)}%
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm text-[#94A3B8]">AI 资金池 (USDT)</label>
              <input
                type="number"
                value={aiFundPool}
                onChange={(e) => setAiFundPool(e.target.value)}
                className="w-full rounded-lg border border-[#1E1E2E] bg-[#1E1E2E] px-4 py-3 text-[#F8F8FC] placeholder-[#64748B] transition-colors focus:border-cyan-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-[#94A3B8]">单笔交易上限 ($)</label>
              <input
                type="number"
                value={maxSingleTrade}
                onChange={(e) => setMaxSingleTrade(e.target.value)}
                className="w-full rounded-lg border border-[#1E1E2E] bg-[#1E1E2E] px-4 py-3 text-[#F8F8FC] placeholder-[#64748B] transition-colors focus:border-cyan-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-[#94A3B8]">最大每日亏损 ($)</label>
              <input
                type="number"
                value={maxDailyLoss}
                onChange={(e) => setMaxDailyLoss(e.target.value)}
                className="w-full rounded-lg border border-[#1E1E2E] bg-[#1E1E2E] px-4 py-3 text-[#F8F8FC] placeholder-[#64748B] transition-colors focus:border-cyan-400 focus:outline-none"
              />
            </div>
          </div>
        </Accordion>

        {/* Accordion 4: 交易所绑定 */}
        <Accordion
          title="交易所绑定"
          summary={
            apiKeysData && apiKeysData.length > 0
              ? `已绑定 ${apiKeysData.length} 个交易所/钱包`
              : "支持 CEX (Binance/OKX/Bybit) 和 DEX (Hyperliquid/Lighter/Aster)"
          }
          icon={<Shield className="h-5 w-5" />}
          isOpen={accordion4Open}
          onToggle={() => setAccordion4Open(!accordion4Open)}
        >
          <div className="space-y-3">
            {apiKeysData && apiKeysData.length > 0 ? (
              apiKeysData.map((item) => {
                const isDex = item.authType === 'wallet';
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-lg bg-[#1E1E2E] p-3"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className="font-medium text-[#F8F8FC]">{item.label}</div>
                        {isDex && (
                          <span className="rounded bg-purple-500/20 px-1.5 py-0.5 text-xs text-purple-400">
                            DEX
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-[#64748B]">
                        {isDex && item.walletAddress
                          ? `${item.walletAddress.slice(0, 6)}...${item.walletAddress.slice(-4)}`
                          : item.maskedKey}
                      </div>
                    </div>
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full ${
                      item.isActive ? 'bg-green-500/20' : 'bg-gray-600/20'
                    }`}>
                      <div className={`h-2 w-2 rounded-full ${
                        item.isActive ? 'bg-green-400' : 'bg-gray-500'
                      }`} />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-lg bg-[#1E1E2E] p-4 text-center text-sm text-[#64748B]">
                暂未绑定任何交易所或钱包
              </div>
            )}

            <button
              type="button"
              onClick={() => window.location.href = '/wallet/api-keys'}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-cyan-400/50 bg-cyan-500/10 px-4 py-3 text-cyan-400 transition-colors hover:bg-cyan-500/20"
            >
              <Link className="h-4 w-4" />
              <span>去绑定页</span>
              <span>→</span>
            </button>
          </div>
        </Accordion>

        {/* Accordion 5: 模型性能 */}
        <Accordion
          title="模型性能"
          summary={
            modelPerformance.length > 0
              ? `${modelPerformance.length} 个模型 · ${modelPerformance[0]?.name} ${modelPerformance[0]?.trades}笔 ${modelPerformance[0]?.winRate}%`
              : '暂无性能数据'
          }
          icon={<BarChart3 className="h-5 w-5" />}
          isOpen={accordion5Open}
          onToggle={() => setAccordion5Open(!accordion5Open)}
        >
          <div className="space-y-3">
            {modelPerformance.length > 0 ? (
              modelPerformance.map((model) => (
                <div
                  key={model.name}
                  className="rounded-lg border border-[#1E1E2E] bg-[#1E1E2E] p-4"
                >
                  <div className="mb-3 flex items-start justify-between">
                    <div>
                      <div className="font-medium text-[#F8F8FC]">{model.name}</div>
                      <div className="text-xs text-[#64748B]">Tier {model.tier}</div>
                    </div>
                    <div className="rounded bg-cyan-500/20 px-2 py-1 text-xs text-cyan-400">
                      进化 {model.tier} 级
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <div className="text-xs text-[#64748B]">交易笔数</div>
                      <div className="mt-1 font-medium text-[#F8F8FC]">{model.trades}</div>
                    </div>
                    <div>
                      <div className="text-xs text-[#64748B]">胜率</div>
                      <div
                        className={`mt-1 font-medium ${
                          model.winRate >= 60 ? 'text-green-400' : 'text-[#F8F8FC]'
                        }`}
                      >
                        {model.winRate}%
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-[#64748B]">Sharpe</div>
                      <div className="mt-1 font-medium text-[#F8F8FC]">
                        {model.sharpe.toFixed(1)}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-[#1E1E2E] bg-[#1E1E2E] p-4 text-center text-sm text-[#64748B]">
                暂无模型性能数据
              </div>
            )}
          </div>
        </Accordion>
      </div>

      {/* Bottom fixed save button */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-[#1E1E2E] bg-[#0A0A0F]/95 p-4 backdrop-blur">
        <button
          type="button"
          onClick={handleSave}
          disabled={updateConfig.isPending}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-500 px-6 py-3 font-medium text-white transition-colors hover:bg-cyan-600 disabled:opacity-50"
        >
          <Save className="h-5 w-5" />
          <span>{updateConfig.isPending ? '保存中...' : '保存设置'}</span>
        </button>
      </div>
    </div>
  );
}
