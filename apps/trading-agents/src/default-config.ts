import path from 'path';
import { fileURLToPath } from 'url';
import type { TradingAgentsConfig } from './types/config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const DEFAULT_CONFIG: TradingAgentsConfig = {
  project_dir: path.resolve(__dirname, '..'),
  results_dir: './results',
  data_cache_dir: path.join(path.resolve(__dirname, '..'), 'dataflows/data_cache'),

  // LLM settings
  llm_provider: 'openai',
  deep_think_llm: 'gpt-4o',
  quick_think_llm: 'gpt-4o-mini',
  backend_url: 'https://api.openai.com/v1',

  // Provider-specific thinking configuration
  google_thinking_level: null,
  openai_reasoning_effort: null,
  anthropic_effort: null,

  // Output language
  output_language: 'English',

  // Debate and discussion settings
  max_debate_rounds: 1,
  max_risk_discuss_rounds: 1,
  max_recur_limit: 100,

  // Data vendor configuration
  data_vendors: {
    core_stock_apis: 'yfinance',
    technical_indicators: 'yfinance',
    fundamental_data: 'yfinance',
    news_data: 'yfinance',
  },
  tool_vendors: {},
};
