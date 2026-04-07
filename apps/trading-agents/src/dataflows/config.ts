/**
 * 全局数据配置管理
 * 对应 Python: tradingagents/dataflows/config.py
 *
 * 提供全局配置的 get/set 接口，供所有 dataflows 模块读取当前 vendor 配置
 */

import type { TradingAgentsConfig } from '../types/config.js';
import { DEFAULT_CONFIG } from '../default-config.js';

let currentConfig: TradingAgentsConfig = { ...DEFAULT_CONFIG };

/**
 * 设置全局配置（覆盖式，非合并）
 */
export function setConfig(config: TradingAgentsConfig): void {
  currentConfig = { ...config };
}

/**
 * 获取当前全局配置（返回副本，防止外部直接修改）
 */
export function getConfig(): TradingAgentsConfig {
  return { ...currentConfig };
}
