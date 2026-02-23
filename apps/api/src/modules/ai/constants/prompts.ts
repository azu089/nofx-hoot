/**
 * AI 提示词 — Barrel 重导出
 *
 * 所有现有的 `import from '../constants/prompts'` 继续工作。
 * 新代码建议直接从细分文件导入:
 *   - './models'           — 共享常量 (AI_ROLES, AI_MODELS, etc.)
 *   - './research-prompts' — 产品A (辩论、角色提示词、记忆模板)
 *   - './trading-prompts'  — 产品B (快速模式、市场数据格式化)
 */

export * from './models';
export * from './locale-instructions';
export * from './research-prompts';
export * from './trading-prompts';
