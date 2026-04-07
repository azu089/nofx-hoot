/**
 * CLI 入口 - 交互式终端界面
 * 对应 Python cli/main.py（精简重写）
 */

import 'dotenv/config';
import { input, select, checkbox } from '@inquirer/prompts';
import chalk from 'chalk';
import ora from 'ora';
import Table from 'cli-table3';
import { TradingAgentsGraph } from '../graph/trading-graph.js';
import type { TradingAgentsConfig } from '../types/config.js';
import type { AnalystType } from '../types/state.js';
import { DEFAULT_CONFIG } from '../default-config.js';

const PROVIDERS = [
  { name: 'OpenAI (GPT)', value: 'openai' },
  { name: 'DeepSeek', value: 'deepseek' },
  { name: 'Anthropic (Claude)', value: 'anthropic' },
  { name: 'Google (Gemini)', value: 'google' },
  { name: 'xAI (Grok)', value: 'xai' },
  { name: 'OpenRouter', value: 'openrouter' },
  { name: 'Ollama (Local)', value: 'ollama' },
] as const;

const MODELS: Record<string, Array<{ name: string; value: string }>> = {
  openai: [
    { name: 'GPT-4o (recommended)', value: 'gpt-4o' },
    { name: 'GPT-4o Mini', value: 'gpt-4o-mini' },
    { name: 'GPT-4.1', value: 'gpt-4.1' },
    { name: 'GPT-4.1 Mini', value: 'gpt-4.1-mini' },
  ],
  deepseek: [
    { name: 'DeepSeek Chat (recommended)', value: 'deepseek-chat' },
    { name: 'DeepSeek Reasoner', value: 'deepseek-reasoner' },
  ],
  anthropic: [
    { name: 'Claude Sonnet 4.6', value: 'claude-sonnet-4-6' },
    { name: 'Claude Haiku 4.5', value: 'claude-haiku-4-5-20251001' },
    { name: 'Claude Opus 4.6', value: 'claude-opus-4-6' },
  ],
  google: [
    { name: 'Gemini 2.5 Pro', value: 'gemini-2.5-pro' },
    { name: 'Gemini 2.5 Flash', value: 'gemini-2.5-flash' },
    { name: 'Gemini 3 Flash Preview', value: 'gemini-3-flash-preview' },
  ],
  xai: [
    { name: 'Grok 4 Fast', value: 'grok-4-fast' },
  ],
  openrouter: [
    { name: 'GPT-4o via OpenRouter', value: 'gpt-4o' },
    { name: 'Claude Sonnet 4.6 via OpenRouter', value: 'claude-sonnet-4-6' },
  ],
  ollama: [
    { name: 'Llama 3.1 8B', value: 'llama3.1' },
    { name: 'Mistral 7B', value: 'mistral' },
  ],
};

const ANALYST_OPTIONS: Array<{ name: string; value: AnalystType }> = [
  { name: 'Market Analyst (Technical Indicators)', value: 'market' },
  { name: 'Social Media Analyst (Sentiment)', value: 'social' },
  { name: 'News Analyst (World Affairs)', value: 'news' },
  { name: 'Fundamentals Analyst (Financial Statements)', value: 'fundamentals' },
];

function printBanner(): void {
  console.log(chalk.cyan(`
╔══════════════════════════════════════════════════╗
║       HOOT Arena Strategy (竞技策略)              ║
║   Multi-Agent LLM Financial Trading Framework     ║
╚══════════════════════════════════════════════════╝
  `));
}

function colorRating(rating: string): string {
  const upper = rating.toUpperCase().trim();
  if (upper === 'BUY') return chalk.green.bold('BUY');
  if (upper === 'OVERWEIGHT') return chalk.greenBright('OVERWEIGHT');
  if (upper === 'HOLD') return chalk.yellow('HOLD');
  if (upper === 'UNDERWEIGHT') return chalk.redBright('UNDERWEIGHT');
  if (upper === 'SELL') return chalk.red.bold('SELL');
  return chalk.white(rating);
}

async function main(): Promise<void> {
  printBanner();

  // 1. Ticker
  const ticker = await input({
    message: 'Enter stock ticker symbol:',
    default: 'AAPL',
    validate: (v) => v.trim().length > 0 || 'Ticker cannot be empty',
  });

  // 2. Date
  const tradeDate = await input({
    message: 'Enter analysis date (YYYY-MM-DD):',
    default: new Date().toISOString().slice(0, 10),
    validate: (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) || 'Invalid date format',
  });

  // 3. Provider
  const provider = await select<string>({
    message: 'Select LLM provider:',
    choices: PROVIDERS as any,
  });

  // 4. Model
  const providerModels = MODELS[provider] || MODELS.openai;
  const deepModel = await select<string>({
    message: 'Select deep thinking model:',
    choices: providerModels,
  });
  const quickModel = await select<string>({
    message: 'Select quick thinking model:',
    choices: providerModels,
  });

  // 5. Analysts
  const selectedAnalysts = await checkbox({
    message: 'Select analysts to include:',
    choices: ANALYST_OPTIONS.map(a => ({ ...a, checked: true })),
  }) as AnalystType[];

  if (selectedAnalysts.length === 0) {
    console.log(chalk.red('At least one analyst must be selected.'));
    process.exit(1);
  }

  // 6. Debate rounds
  const debateRounds = await input({
    message: 'Max debate rounds (Bull vs Bear):',
    default: '1',
  });
  const riskRounds = await input({
    message: 'Max risk discussion rounds:',
    default: '1',
  });

  // Build config
  const config: Partial<TradingAgentsConfig> = {
    llm_provider: provider as TradingAgentsConfig['llm_provider'],
    deep_think_llm: deepModel,
    quick_think_llm: quickModel,
    max_debate_rounds: parseInt(debateRounds) || 1,
    max_risk_discuss_rounds: parseInt(riskRounds) || 1,
  };

  console.log('');
  console.log(chalk.cyan('Configuration:'));
  const configTable = new Table();
  configTable.push(
    { 'Ticker': ticker as any },
    { 'Date': tradeDate as any },
    { 'Provider': provider as any },
    { 'Deep Model': deepModel as any },
    { 'Quick Model': quickModel as any },
    { 'Analysts': selectedAnalysts.join(', ') as any },
    { 'Debate Rounds': debateRounds as any },
    { 'Risk Rounds': riskRounds as any },
  );
  console.log(configTable.toString());
  console.log('');

  // Create graph
  const spinner = ora('Initializing Arena Strategy...').start();

  try {
    const graph = new TradingAgentsGraph({
      selectedAnalysts,
      debug: true,
      config,
    });

    spinner.succeed('Arena Strategy initialized.');

    // Run analysis
    const phases = [
      'Analysts researching...',
      'Investment debate...',
      'Research Manager judging...',
      'Trader planning...',
      'Risk debate...',
      'Portfolio Manager deciding...',
    ];

    const analysisSpinner = ora(phases[0]).start();

    const { state, signal } = await graph.propagate(ticker, tradeDate);

    analysisSpinner.succeed('Analysis complete!');

    // Display results
    console.log('');
    console.log(chalk.cyan('═══════════════════════════════════════════'));
    console.log(chalk.cyan.bold('  FINAL TRADING DECISION'));
    console.log(chalk.cyan('═══════════════════════════════════════════'));
    console.log('');
    console.log(`  Rating: ${colorRating(signal)}`);
    console.log('');

    // Results table
    const resultsTable = new Table({
      head: [chalk.cyan('Section'), chalk.cyan('Summary')],
      colWidths: [25, 75],
      wordWrap: true,
    });

    resultsTable.push(
      ['Market Report', (state.market_report || 'N/A').slice(0, 200) + '...'],
      ['News Report', (state.news_report || 'N/A').slice(0, 200) + '...'],
      ['Sentiment Report', (state.sentiment_report || 'N/A').slice(0, 200) + '...'],
      ['Fundamentals', (state.fundamentals_report || 'N/A').slice(0, 200) + '...'],
      ['Investment Plan', (state.investment_plan || 'N/A').slice(0, 200) + '...'],
      ['Trader Plan', (state.trader_investment_plan || 'N/A').slice(0, 200) + '...'],
      ['Final Decision', (state.final_trade_decision || 'N/A').slice(0, 300) + '...'],
    );

    console.log(resultsTable.toString());
    console.log('');
    console.log(chalk.green(`Full results saved to: results/${ticker}/ArenaStrategy_logs/`));

  } catch (error: any) {
    spinner.fail(`Error: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

main().catch(console.error);
