import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * 自动审核服务 - Phase 16 完整版
 *
 * 核心功能（4 项检查）：
 * 1. 恶意代码检测（禁止危险函数：os, subprocess, eval, exec, __import__, open, requests）
 * 2. API 密钥安全检测（禁止硬编码 API Key/Secret/Token/Password）
 * 3. 资源滥用检测（无限循环、大范围循环、递归深度）
 * 4. 性能问题检测（必需方法、INTERFACE_VERSION、向量化建议）
 *
 * 审核结果：
 * - passed: true/false（是否通过自动审核）
 * - warnings: string[]（警告列表，不阻止上架）
 * - criticalIssues: string[]（严重问题列表，导致审核不通过）
 *
 * 审核规则：
 * - 恶意代码 + API 安全检测到问题 → 审核失败（flagged，需人工审核）
 * - 资源滥用 + 性能问题 → 仅警告提示，不阻止上架
 */

interface CheckResult {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  passed: boolean;
  criticalIssues: string[];
  warnings: string[];
  details: Record<string, any>;
}

interface AutoReviewResult {
  passed: boolean;
  warnings: string[];
  criticalIssues: string[];
}

@Injectable()
export class AutoReviewService {
  private readonly logger = new Logger(AutoReviewService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 执行策略自动审核
   * @param strategyId 策略 ID
   * @returns 审核结果
   */
  async performAutoReview(strategyId: string): Promise<AutoReviewResult> {
    this.logger.log(`开始自动审核策略: ${strategyId}`);

    // 获取策略代码
    const strategy = await this.prisma.client.strategies.findUnique({
      where: { id: strategyId },
      select: { content: true, name: true },
    });

    if (!strategy) {
      throw new Error(`策略不存在: ${strategyId}`);
    }

    // 执行 4 项核心检测（Phase 16 完整版）
    const checks = await Promise.all([
      this.checkMaliciousCode(strategy.content),
      this.checkAPIKeySecurity(strategy.content),
      this.checkResourceAbuse(strategy.content),
      this.checkPerformanceIssues(strategy.content),
    ]);

    // 汇总结果
    const warnings = checks.flatMap((c) => c.warnings);
    const criticalIssues = checks.flatMap((c) => c.criticalIssues);
    const passed = criticalIssues.length === 0;

    this.logger.log(
      `策略 ${strategyId} 自动审核${passed ? '通过' : '失败'}: ` +
        `${criticalIssues.length} 个严重问题, ${warnings.length} 个警告`,
    );

    return { passed, warnings, criticalIssues };
  }

  /**
   * 1. 恶意代码检测
   *
   * 禁止使用以下危险模块和函数：
   * - import os（操作系统接口）
   * - import subprocess（子进程执行）
   * - eval()（动态代码执行）
   * - exec()（代码执行）
   * - __import__（动态导入）
   * - open()（文件操作）
   * - requests.get（外部 HTTP 请求）
   */
  private async checkMaliciousCode(code: string): Promise<CheckResult> {
    const dangerousPatterns = [
      { pattern: /import\s+os\b/g, desc: '禁止导入 os 模块（操作系统接口）' },
      { pattern: /from\s+os\s+import/g, desc: '禁止从 os 模块导入' },
      { pattern: /import\s+subprocess/g, desc: '禁止导入 subprocess 模块（子进程执行）' },
      { pattern: /from\s+subprocess\s+import/g, desc: '禁止从 subprocess 模块导入' },
      { pattern: /\beval\s*\(/g, desc: '禁止使用 eval 函数（动态代码执行）' },
      { pattern: /\bexec\s*\(/g, desc: '禁止使用 exec 函数（代码执行）' },
      { pattern: /__import__\s*\(/g, desc: '禁止使用 __import__ 函数（动态导入）' },
      { pattern: /\bopen\s*\(/g, desc: '禁止使用 open 函数（文件操作）' },
      { pattern: /requests\.(get|post|put|delete|patch)/g, desc: '禁止使用 requests 库（外部 HTTP 请求）' },
    ];

    const criticalIssues: string[] = [];

    for (const { pattern, desc } of dangerousPatterns) {
      const matches = code.match(pattern);
      if (matches) {
        criticalIssues.push(`${desc}，检测到 ${matches.length} 处使用`);
      }
    }

    return {
      type: 'malicious_code',
      severity: criticalIssues.length > 0 ? 'critical' : 'low',
      passed: criticalIssues.length === 0,
      criticalIssues,
      warnings: [],
      details: { patternsChecked: dangerousPatterns.length },
    };
  }

  /**
   * 2. API 密钥安全检测
   *
   * 禁止硬编码以下敏感信息：
   * - API Key（api_key = "xxx"）
   * - Secret（secret = "xxx"）
   * - Token（token = "xxx"）
   * - Password（password = "xxx"）
   *
   * 允许：
   * - 从环境变量读取（os.getenv）
   * - 从配置文件读取（config.get）
   */
  private async checkAPIKeySecurity(code: string): Promise<CheckResult> {
    const sensitivePatterns = [
      {
        pattern: /api[_-]?key\s*=\s*['"][a-zA-Z0-9]{16,}['"]/gi,
        desc: '检测到硬编码的 API Key',
      },
      {
        pattern: /secret\s*=\s*['"][a-zA-Z0-9]{16,}['"]/gi,
        desc: '检测到硬编码的 Secret',
      },
      {
        pattern: /token\s*=\s*['"][a-zA-Z0-9]{16,}['"]/gi,
        desc: '检测到硬编码的 Token',
      },
      {
        pattern: /password\s*=\s*['"][^'"]{8,}['"]/gi,
        desc: '检测到硬编码的密码',
      },
    ];

    const criticalIssues: string[] = [];

    for (const { pattern, desc } of sensitivePatterns) {
      const matches = code.match(pattern);
      if (matches) {
        // 排除注释中的匹配
        const realMatches = matches.filter((match) => {
          const lines = code.split('\n');
          return !lines.some(
            (line) => line.includes(match) && line.trim().startsWith('#'),
          );
        });

        if (realMatches.length > 0) {
          criticalIssues.push(
            `${desc}（${realMatches.length} 处），存在安全风险`,
          );
        }
      }
    }

    return {
      type: 'api_security',
      severity: criticalIssues.length > 0 ? 'critical' : 'low',
      passed: criticalIssues.length === 0,
      criticalIssues,
      warnings: [],
      details: { patternsChecked: sensitivePatterns.length },
    };
  }

  /**
   * 3. 资源滥用检测
   *
   * 检测可能导致资源耗尽的代码模式：
   * - 无限循环（while True 且无 break）
   * - 大范围循环（range(1000000+)）
   * - 递归深度过大（可能导致栈溢出）
   * - 过大数据结构分配
   */
  private async checkResourceAbuse(code: string): Promise<CheckResult> {
    const warnings: string[] = [];

    // 检测无限循环（while True 且整个代码块无 break）
    if (/while\s+True\s*:/i.test(code)) {
      // 检查是否有对应的 break 语句
      const whileTrueMatches = code.match(/while\s+True\s*:/gi);
      const breakMatches = code.match(/\bbreak\b/g);

      if (!breakMatches || breakMatches.length < (whileTrueMatches?.length || 0)) {
        warnings.push(
          '检测到可能的无限循环（while True 且缺少 break），可能导致资源耗尽',
        );
      }
    }

    // 检测大范围循环（range >= 100万）
    const largeRangePattern = /range\s*\(\s*(\d{7,})\s*\)/g;
    const largeRangeMatches = code.match(largeRangePattern);
    if (largeRangeMatches) {
      warnings.push(
        `检测到大范围循环（${largeRangeMatches.length} 处），可能消耗过多 CPU 和内存`,
      );
    }

    // 检测嵌套循环深度 >= 3 层
    const nestedLoopPattern = /for\s+\w+\s+in.*?:\s*for\s+\w+\s+in.*?:\s*for\s+\w+\s+in/s;
    if (nestedLoopPattern.test(code)) {
      warnings.push('检测到 3 层及以上嵌套循环，可能影响性能');
    }

    // 检测递归函数（函数内部调用自身）
    const funcDefPattern = /def\s+(\w+)\s*\(/g;
    let match;
    const recursiveFuncs: string[] = [];
    while ((match = funcDefPattern.exec(code)) !== null) {
      const funcName = match[1];
      const funcBody = code.substring(match.index);
      const funcEndIndex = funcBody.indexOf('\ndef ');
      const actualBody =
        funcEndIndex > 0 ? funcBody.substring(0, funcEndIndex) : funcBody;

      // 检查函数体内是否调用自身
      const recursivePattern = new RegExp(`\\b${funcName}\\s*\\(`, 'g');
      const recursiveCalls = actualBody.match(recursivePattern);
      if (recursiveCalls && recursiveCalls.length > 1) {
        // > 1 因为函数定义本身算一次
        recursiveFuncs.push(funcName);
      }
    }

    if (recursiveFuncs.length > 0) {
      warnings.push(
        `检测到递归函数（${recursiveFuncs.join(', ')}），可能导致栈溢出`,
      );
    }

    return {
      type: 'resource_abuse',
      severity: warnings.length > 0 ? 'medium' : 'low',
      passed: true, // 警告不阻止上架，仅提示
      criticalIssues: [],
      warnings,
      details: { warningCount: warnings.length },
    };
  }

  /**
   * 4. 性能问题检测
   *
   * 检测 Freqtrade 策略必需方法和常见性能问题：
   * - 必需方法：populate_indicators, populate_entry_trend, populate_exit_trend
   * - 缺少 INTERFACE_VERSION 常量
   * - 在循环中执行大量计算（应使用向量化）
   */
  private async checkPerformanceIssues(code: string): Promise<CheckResult> {
    const warnings: string[] = [];

    // 检测 Freqtrade 策略必需方法
    const requiredMethods = [
      'populate_indicators',
      'populate_entry_trend',
      'populate_exit_trend',
    ];

    for (const method of requiredMethods) {
      const methodPattern = new RegExp(`def\\s+${method}\\s*\\(`, 'g');
      if (!methodPattern.test(code)) {
        warnings.push(`缺少 Freqtrade 必需方法: ${method}`);
      }
    }

    // 检测 INTERFACE_VERSION（Freqtrade v3 策略必需）
    if (!/INTERFACE_VERSION\s*=\s*[0-9]+/.test(code)) {
      warnings.push('缺少 INTERFACE_VERSION 常量（Freqtrade v3 必需）');
    }

    // 检测是否继承 IStrategy 基类
    if (!/class\s+\w+\s*\(\s*IStrategy\s*\)/.test(code)) {
      warnings.push('策略类未继承 IStrategy 基类');
    }

    // 检测在 for 循环中执行重复计算（应使用 pandas 向量化）
    const loopCalcPattern = /for\s+\w+\s+in.*?:\s*.*?(ta\.|dataframe\[)/s;
    if (loopCalcPattern.test(code)) {
      warnings.push(
        '检测到在循环中执行计算，建议使用 pandas 向量化提升性能',
      );
    }

    return {
      type: 'performance',
      severity: warnings.length > 2 ? 'medium' : 'low',
      passed: true, // 性能问题不阻止上架，仅提示
      criticalIssues: [],
      warnings,
      details: { requiredMethodsCount: requiredMethods.length },
    };
  }
}
