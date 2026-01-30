'use client'

import { useState } from 'react'
import {
  Wallet,
  ArrowDownToLine,
  ArrowUpFromLine,
  Repeat2,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Plus,
  MoreVertical,
} from 'lucide-react'

// 类型定义
interface Asset {
  id: string
  name: string
  symbol: string
  icon: React.ReactNode
  amount: number
  usdValue: number
  isLocked?: boolean
  released?: number
  total?: number
  releaseProgress?: number
}

interface Transaction {
  id: string
  type: 'deposit' | 'withdraw' | 'exchange'
  typeName: string
  amount: string
  status: 'pending' | 'completed' | 'failed'
  statusName: string
  time: string
  isPositive: boolean
}

interface ExchangeAPI {
  id: string
  name: string
  isActive: boolean
  balance: string
}

type TabType = 'assets' | 'bills' | 'api'
type FilterType = 'all' | 'deposit' | 'withdraw' | 'exchange'

interface MobileWalletV3Props {
  onNavigate?: (page: 'deposit' | 'withdraw' | 'exchange' | 'api-add') => void
}

export function MobileWalletV3({ onNavigate }: MobileWalletV3Props) {
  const [activeTab, setActiveTab] = useState<TabType>("assets");
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");

  // 模拟数据 - 与桌面端对齐
  const totalBalance = 12847.32;
  const change24h = {
    amount: 299.99,
    percentage: 2.34,
    isPositive: true,
  };

  const assets: Asset[] = [
    {
      id: "usdt",
      name: "Tether USD",
      symbol: "USDT",
      icon: <div className="w-10 h-10 rounded-full bg-[#26A17B] flex items-center justify-center text-white font-semibold text-sm">₮</div>,
      amount: 10346.57,
      usdValue: 10346.57,
    },
    {
      id: "hoot",
      name: "HOOT Token",
      symbol: "HOOT",
      icon: <div className="w-10 h-10 rounded-full bg-[#06B6D4] flex items-center justify-center text-white font-semibold text-sm">H</div>,
      amount: 2500.75,
      usdValue: 2500.75,
    },
    {
      id: "locked",
      name: "HOOT (释放中)",
      symbol: "HOOT",
      icon: <div className="w-10 h-10 rounded-full bg-[#8B5CF6] flex items-center justify-center text-white font-semibold text-sm">L</div>,
      amount: 15000,
      usdValue: 15000,
      isLocked: true,
      released: 3000,
      total: 18000,
      releaseProgress: 16.67,
    },
    {
      id: "gas",
      name: "点卡",
      symbol: "GAS",
      icon: <div className="w-10 h-10 rounded-full bg-[#F59E0B] flex items-center justify-center text-white font-semibold text-sm">G</div>,
      amount: 1250,
      usdValue: 1250.0,
    },
  ];

  const transactions: Transaction[] = [
    {
      id: "1",
      type: "deposit",
      typeName: "充值",
      amount: "+1000.00 USDT",
      status: "completed",
      statusName: "已完成",
      time: "2024-01-15 14:30",
      isPositive: true,
    },
    {
      id: "2",
      type: "withdraw",
      typeName: "提现",
      amount: "-500.00 USDT",
      status: "pending",
      statusName: "处理中",
      time: "2024-01-15 12:15",
      isPositive: false,
    },
    {
      id: "3",
      type: "exchange",
      typeName: "兑换",
      amount: "250 USDT → HOOT",
      status: "completed",
      statusName: "已完成",
      time: "2024-01-14 18:20",
      isPositive: true,
    },
  ];

  const exchanges: ExchangeAPI[] = [
    {
      id: '1',
      name: 'Binance',
      isActive: true,
      balance: '$ 5,234.56',
    },
    {
      id: '2',
      name: 'OKX',
      isActive: false,
      balance: '$ 0.00',
    },
  ]

  // 快捷操作按钮
  const quickActions = [
    { icon: <ArrowDownToLine className="w-5 h-5" />, label: '充值', action: () => onNavigate?.('deposit') },
    { icon: <ArrowUpFromLine className="w-5 h-5" />, label: '提现', action: () => onNavigate?.('withdraw') },
    { icon: <Repeat2 className="w-5 h-5" />, label: '兑换', action: () => onNavigate?.('exchange') },
  ]

  // 筛选交易
  const filteredTransactions = transactions.filter((tx) => {
    if (activeFilter === "all") return true;
    return tx.type === activeFilter;
  });

  // 获取交易图标
  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "deposit":
        return <ArrowDownToLine className="w-5 h-5" />;
      case "withdraw":
        return <ArrowUpFromLine className="w-5 h-5" />;
      case "exchange":
        return <Repeat2 className="w-5 h-5" />;
      default:
        return <Wallet className="w-5 h-5" />;
    }
  };

  // 获取状态图标
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="w-4 h-4 text-[#22C55E]" />;
      case "pending":
        return <Clock className="w-4 h-4 text-[#F59E0B]" />;
      case "failed":
        return <XCircle className="w-4 h-4 text-[#EF4444]" />;
      default:
        return <AlertCircle className="w-4 h-4 text-[#94A3B8]" />;
    }
  };

  return (
    <div className="h-screen flex flex-col bg-[#0A0A0F] text-white">
      {/* 顶部资产总览卡片 */}
      <div className="shrink-0 glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border-b border-cyan-500/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-6">
        <div className="max-w-[390px] mx-auto">
          {/* 总资产 */}
          <div className="text-center mb-4">
            <div className="text-[#94A3B8] text-sm mb-2">总资产 (USDT)</div>
            <div className="text-4xl font-bold mb-2">
              {totalBalance.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            {/* 24小时涨跌 */}
            <div
              className={`flex items-center justify-center gap-1 text-sm ${
                change24h.isPositive ? "text-[#22C55E]" : "text-[#EF4444]"
              }`}
            >
              {change24h.isPositive ? (
                <TrendingUp className="w-4 h-4" />
              ) : (
                <TrendingDown className="w-4 h-4" />
              )}
              <span>
                {change24h.isPositive ? "+" : "-"}
                {Math.abs(change24h.amount).toFixed(2)} (
                {change24h.isPositive ? "+" : "-"}
                {Math.abs(change24h.percentage).toFixed(2)}%)
              </span>
            </div>
          </div>

          {/* 快捷操作按钮 */}
          <div className="grid grid-cols-3 gap-3">
            {quickActions.map((action, index) => (
              <button
                type="button"
                key={index}
                onClick={action.action}
                className="bg-[#1A1A24] hover:bg-[#1E1E2E] border border-[#1E1E2E] rounded-lg py-3 px-4 flex flex-col items-center gap-2 transition-colors"
                title={action.label}
                aria-label={action.label}
              >
                <div className="text-[#06B6D4]">{action.icon}</div>
                <span className="text-sm text-[#94A3B8]">{action.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab 切换栏 */}
      <div className="shrink-0 bg-[#12121A] border-b border-[#1E1E2E]">
        <div className="flex">
          {[
            { key: 'assets' as TabType, label: '资产' },
            { key: 'bills' as TabType, label: '账单' },
            { key: 'api' as TabType, label: 'API' },
          ].map((tab) => (
            <button
              type="button"
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-4 text-center text-sm font-medium transition-colors relative ${
                activeTab === tab.key
                  ? 'text-[#06B6D4]'
                  : 'text-[#94A3B8] hover:text-[#94A3B8]'
              }`}
              title={tab.label}
              aria-label={tab.label}
            >
              {tab.label}
              {activeTab === tab.key && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#06B6D4]" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab 内容 */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* 资产 Tab */}
        {activeTab === "assets" && (
          <div className="space-y-3">
            {assets.map((asset) => (
              <div
                key={asset.id}
                className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-lg shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden p-4"
              >
                <div className="flex items-center justify-between">
                  {/* 左侧：图标 + 名称 */}
                  <div className="flex items-center gap-3">
                    {asset.icon}
                    <div>
                      <div className="font-medium text-white">{asset.name}</div>
                      <div className="text-sm text-[#94A3B8]">{asset.symbol}</div>
                    </div>
                  </div>

                  {/* 右侧：数量 + 价值 */}
                  <div className="text-right">
                    <div className="font-medium text-white">
                      {asset.amount.toLocaleString()}
                    </div>
                    <div className="text-sm text-[#94A3B8]">
                      ≈ ${asset.usdValue.toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* 释放中资产进度条 */}
                {asset.isLocked && (
                  <div className="mt-4 pt-4 border-t border-[#1E1E2E]">
                    <div className="flex justify-between text-xs text-[#94A3B8] mb-2">
                      <span>
                        已释放: {asset.released?.toLocaleString()}
                      </span>
                      <span>总锁定: {asset.total?.toLocaleString()}</span>
                    </div>
                    <div className="w-full bg-[#1A1A24] rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#06B6D4] to-[#22C55E] rounded-full transition-all"
                        style={{ width: `${asset.releaseProgress}%` }}
                      />
                    </div>
                    <div className="text-right text-xs text-[#94A3B8] mt-1">
                      {asset.releaseProgress}%
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 账单 Tab */}
        {activeTab === "bills" && (
          <div className="space-y-4">
            {/* 筛选按钮组 */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              {[
                { key: 'all' as FilterType, label: '全部' },
                { key: 'deposit' as FilterType, label: '充值' },
                { key: 'withdraw' as FilterType, label: '提现' },
                { key: 'exchange' as FilterType, label: '兑换' },
              ].map((filter) => (
                <button
                  type="button"
                  key={filter.key}
                  onClick={() => setActiveFilter(filter.key)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                    activeFilter === filter.key
                      ? 'bg-[#06B6D4] text-white'
                      : 'bg-[#12121A] text-[#94A3B8] border border-[#1E1E2E] hover:bg-[#1A1A24]'
                  }`}
                  title={filter.label}
                  aria-label={filter.label}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            {/* 交易记录列表 */}
            <div className="space-y-3">
              {filteredTransactions.map((tx) => (
                <div
                  key={tx.id}
                  className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-lg shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    {/* 左侧：图标 + 类型 */}
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#1A1A24] flex items-center justify-center text-[#06B6D4]">
                        {getTransactionIcon(tx.type)}
                      </div>
                      <div>
                        <div className="font-medium text-white">
                          {tx.typeName}
                        </div>
                        <div className="text-xs text-[#94A3B8]">{tx.time}</div>
                      </div>
                    </div>

                    {/* 右侧：金额 + 状态 */}
                    <div className="text-right">
                      <div
                        className={`font-medium ${
                          tx.isPositive ? "text-[#22C55E]" : "text-[#EF4444]"
                        }`}
                      >
                        {tx.amount}
                      </div>
                      <div className="flex items-center justify-end gap-1 mt-1">
                        {getStatusIcon(tx.status)}
                        <span className="text-xs text-[#94A3B8]">
                          {tx.statusName}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* 空状态 */}
            {filteredTransactions.length === 0 && (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-full bg-[#12121A] flex items-center justify-center mx-auto mb-4">
                  <Wallet className="w-8 h-8 text-[#94A3B8]" />
                </div>
                <div className="text-[#94A3B8]">暂无交易记录</div>
              </div>
            )}
          </div>
        )}

        {/* API Tab */}
        {activeTab === "api" && (
          <div className="space-y-4">
            {/* 已绑定交易所列表 */}
            <div className="space-y-3">
              {exchanges.map((exchange) => (
                <div
                  key={exchange.id}
                  className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-lg shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    {/* 左侧：名称 + 状态 */}
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#1A1A24] flex items-center justify-center text-[#06B6D4] font-semibold">
                        {exchange.name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-medium text-white flex items-center gap-2">
                          {exchange.name}
                          <div
                            className={`w-2 h-2 rounded-full ${
                              exchange.isActive
                                ? "bg-[#22C55E]"
                                : "bg-[#64748B]"
                            }`}
                            title={exchange.isActive ? "在线" : "离线"}
                          />
                        </div>
                        <div className="text-sm text-[#94A3B8]">
                          {exchange.isActive ? "已连接" : "未连接"}
                        </div>
                      </div>
                    </div>

                    {/* 右侧：更多按钮 */}
                    <button
                      type="button"
                      className="w-8 h-8 rounded-lg hover:bg-[#1A1A24] flex items-center justify-center text-[#94A3B8] transition-colors"
                      title="更多操作"
                      aria-label="更多操作"
                    >
                      <MoreVertical className="w-5 h-5" />
                    </button>
                  </div>

                  {/* 余额 */}
                  <div className="flex justify-between items-center pt-3 border-t border-[#1E1E2E]">
                    <span className="text-sm text-[#94A3B8]">账户余额</span>
                    <span className="font-medium text-white">
                      {exchange.balance}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* 添加新API按钮 */}
            <button
              type="button"
              onClick={() => onNavigate?.('api-add')}
              className="w-full bg-[#06B6D4] hover:bg-[#0891B2] text-white font-medium py-4 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
              title="添加新的交易所 API"
              aria-label="添加新的交易所 API"
            >
              <Plus className="w-5 h-5" />
              <span>添加新的交易所 API</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
