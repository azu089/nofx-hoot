'use client';

import { useState, useEffect, useRef } from 'react';
import { marketApi } from '@/lib/api';
import { Search, X, Check, Loader2, TrendingUp } from 'lucide-react';

interface SymbolSearchProps {
  /** 已选择的交易对 */
  selectedSymbols: string[];
  /** 选择变化回调 */
  onSelectionChange: (symbols: string[]) => void;
  /** 最大可选数量 */
  maxSelection?: number;
  /** 是否显示标签 */
  label?: string;
}

/**
 * 交易对搜索组件
 * 支持搜索、多选、热门交易对快捷选择
 */
export function SymbolSearch({
  selectedSymbols,
  onSelectionChange,
  maxSelection = 10,
  label = '交易对选择',
}: SymbolSearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [popularSymbols, setPopularSymbols] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 加载热门交易对
  useEffect(() => {
    const loadPopularSymbols = async () => {
      try {
        const res = await marketApi.getPopularSymbols();
        if (res.code === 0 && res.data) {
          setPopularSymbols(res.data);
          // 如果没有搜索词，显示热门交易对
          if (!searchValue) {
            setSearchResults(res.data);
          }
        }
      } catch (err) {
        console.error('加载热门交易对失败:', err);
        // 使用默认热门交易对
        const defaults = ['BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT', 'XRP/USDT'];
        setPopularSymbols(defaults);
        setSearchResults(defaults);
      } finally {
        setInitialLoading(false);
      }
    };

    loadPopularSymbols();
  }, []);

  // 搜索交易对
  useEffect(() => {
    const searchSymbols = async () => {
      if (!searchValue.trim()) {
        setSearchResults(popularSymbols);
        return;
      }

      setLoading(true);
      try {
        const res = await marketApi.searchSymbols(searchValue, 50);
        if (res.code === 0 && res.data) {
          setSearchResults(res.data);
        }
      } catch (err) {
        console.error('搜索交易对失败:', err);
      } finally {
        setLoading(false);
      }
    };

    // 防抖搜索
    const timer = setTimeout(searchSymbols, 300);
    return () => clearTimeout(timer);
  }, [searchValue, popularSymbols]);

  // 点击外部关闭下拉
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 切换选择
  const toggleSymbol = (symbol: string) => {
    if (selectedSymbols.includes(symbol)) {
      // 取消选择
      onSelectionChange(selectedSymbols.filter((s) => s !== symbol));
    } else {
      // 添加选择（检查最大数量）
      if (selectedSymbols.length < maxSelection) {
        onSelectionChange([...selectedSymbols, symbol]);
      }
    }
  };

  // 移除已选择的交易对
  const removeSymbol = (symbol: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectionChange(selectedSymbols.filter((s) => s !== symbol));
  };

  // 全选热门
  const selectAllPopular = () => {
    const combined = [...selectedSymbols, ...popularSymbols.slice(0, maxSelection)];
    const uniqueSet = new Set(combined);
    const newSelection = Array.from(uniqueSet);
    onSelectionChange(newSelection.slice(0, maxSelection));
  };

  // 清空选择
  const clearAll = () => {
    onSelectionChange([]);
  };

  return (
    <div className="space-y-2" ref={containerRef}>
      {/* 标签 */}
      {label && (
        <label className="block text-sm font-medium text-text-primary">{label}</label>
      )}

      {/* 已选择的交易对 */}
      <div className="flex flex-wrap gap-2 min-h-[32px]">
        {selectedSymbols.map((symbol) => (
          <span
            key={symbol}
            className="inline-flex items-center gap-1 px-2 py-1 bg-brand-primary/20 border border-brand-primary/30 rounded-lg text-sm text-brand-primary"
          >
            {symbol.replace('/USDT', '')}
            <button
              onClick={(e) => removeSymbol(symbol, e)}
              className="hover:text-white transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        {selectedSymbols.length === 0 && (
          <span className="text-text-tertiary text-sm py-1">点击下方添加交易对</span>
        )}
      </div>

      {/* 搜索输入框 */}
      <div className="relative">
        <div
          className="flex items-center gap-2 px-3 py-2 bg-bg-tertiary border border-border-primary rounded-lg cursor-text"
          onClick={() => {
            setIsOpen(true);
            inputRef.current?.focus();
          }}
        >
          <Search className="w-4 h-4 text-text-tertiary" />
          <input
            ref={inputRef}
            type="text"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onFocus={() => setIsOpen(true)}
            placeholder="搜索交易对，如 BTC、DOGE、SHIB..."
            className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none"
          />
          {(loading || initialLoading) && (
            <Loader2 className="w-4 h-4 text-text-tertiary animate-spin" />
          )}
        </div>

        {/* 下拉列表 */}
        {isOpen && (
          <div className="absolute z-50 w-full mt-2 bg-bg-secondary border border-border-primary rounded-xl shadow-xl max-h-[300px] overflow-hidden">
            {/* 快捷操作 */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-border-primary/50">
              <span className="text-xs text-text-tertiary">
                已选 {selectedSymbols.length}/{maxSelection}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={selectAllPopular}
                  className="text-xs text-brand-primary hover:text-brand-secondary transition-colors"
                >
                  选热门
                </button>
                <button
                  onClick={clearAll}
                  className="text-xs text-text-secondary hover:text-text-primary transition-colors"
                >
                  清空
                </button>
              </div>
            </div>

            {/* 搜索结果 */}
            <div className="overflow-y-auto max-h-[240px]">
              {!searchValue && (
                <div className="px-3 py-2 border-b border-border-primary/30">
                  <div className="flex items-center gap-1.5 text-xs text-text-tertiary">
                    <TrendingUp className="w-3 h-3" />
                    热门交易对
                  </div>
                </div>
              )}

              {searchResults.length === 0 ? (
                <div className="py-8 text-center text-text-tertiary text-sm">
                  {loading ? '搜索中...' : '未找到匹配的交易对'}
                </div>
              ) : (
                <div className="py-1">
                  {searchResults.map((symbol) => {
                    const isSelected = selectedSymbols.includes(symbol);
                    const isDisabled = !isSelected && selectedSymbols.length >= maxSelection;

                    return (
                      <button
                        key={symbol}
                        onClick={() => !isDisabled && toggleSymbol(symbol)}
                        disabled={isDisabled}
                        className={`w-full flex items-center justify-between px-3 py-2.5 text-sm transition-colors ${
                          isSelected
                            ? 'bg-brand-primary/10 text-brand-primary'
                            : isDisabled
                            ? 'text-text-disabled cursor-not-allowed'
                            : 'text-text-primary hover:bg-bg-tertiary'
                        }`}
                      >
                        <span className="font-medium">{symbol}</span>
                        {isSelected && <Check className="w-4 h-4" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 提示信息 */}
      <p className="text-xs text-text-tertiary">
        支持搜索任意 Binance 上的 USDT 交易对
      </p>
    </div>
  );
}
