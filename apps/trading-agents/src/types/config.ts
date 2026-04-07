/**
 * Configuration types for Arena Strategy (竞技策略)
 * strategy_type: 'arena'
 */

export const STRATEGY_TYPE = 'arena' as const;
export const STRATEGY_NAME = '竞技策略' as const;

export interface DataVendors {
  core_stock_apis: 'yfinance' | 'alpha_vantage';
  technical_indicators: 'yfinance' | 'alpha_vantage';
  fundamental_data: 'yfinance' | 'alpha_vantage';
  news_data: 'yfinance' | 'alpha_vantage';
}

export interface TradingAgentsConfig {
  // Directories
  project_dir: string;
  results_dir: string;
  data_cache_dir: string;

  // LLM settings
  llm_provider: 'openai' | 'deepseek' | 'anthropic' | 'google' | 'xai' | 'openrouter' | 'ollama';
  deep_think_llm: string;
  quick_think_llm: string;
  backend_url: string;

  // Provider-specific thinking configuration
  google_thinking_level?: string | null;
  openai_reasoning_effort?: string | null;
  anthropic_effort?: string | null;

  // Output language
  output_language: string;

  // Debate and discussion settings
  max_debate_rounds: number;
  max_risk_discuss_rounds: number;
  max_recur_limit: number;

  // Data vendor configuration
  data_vendors: DataVendors;
  tool_vendors: Record<string, string>;
}
