import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * 交易历史记录接口
 */
export interface TradeRecord {
  symbol: string;
  side: string;
  entryPrice: number;
  exitPrice: number;
  pnl: number;
  pnlPercent: number;
  closedAt: Date;
  direction: string; // long/short
}

/**
 * 交易统计接口
 */
export interface TradeStats {
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  avgWinPnl: number;
  avgLossPnl: number;
  profitFactor: number;
  sharpeRatio: number;
  bestSymbol: string | null;
  worstSymbol: string | null;
}

/**
 * P3 自学习进化：交易历史分析服务
 * 查询 AI 生成的交易历史，计算性能指标，生成 prompt 注入数据
 */
@Injectable()
export class TradeHistoryService {
  constructor(private prisma: PrismaService) {}

  /**
   * 获取近期交易记录
   * 查询由 AI 分析生成的已平仓持仓
   */
  async getRecentTrades(userId: string, limit: number = 10): Promise<TradeRecord[]> {
    // 查找用户的所有 AI 分析生成的 signalId
    const aiAnalyses = await this.prisma.aiAnalysis.findMany({
      where: {
        userId,
        status: 'executed',
        signalId: { not: null },
      },
      select: { signalId: true },
    });

    const signalIds = aiAnalyses
      .map(a => a.signalId)
      .filter((id): id is string => id !== null);

    if (signalIds.length === 0) {
      return [];
    }

    // 查找这些 signalId 对应的已平仓持仓
    const positions = await this.prisma.position.findMany({
      where: {
        userId,
        signalId: { in: signalIds },
        status: 'closed',
        closedAt: { not: null },
        exitPrice: { not: null },
        pnl: { not: null },
      },
      orderBy: { closedAt: 'desc' },
      take: limit,
    });

    return positions.map(pos => {
      const entryPrice = Number(pos.entryPrice);
      const exitPrice = Number(pos.exitPrice);
      const pnl = Number(pos.pnl);
      const margin = Number(pos.margin);

      // 计算盈亏百分比
      const pnlPercent = margin > 0 ? (pnl / margin) * 100 : 0;

      return {
        symbol: pos.symbol,
        side: pos.side,
        entryPrice,
        exitPrice: exitPrice,
        pnl,
        pnlPercent,
        closedAt: pos.closedAt!,
        direction: pos.side,
      };
    });
  }

  /**
   * 获取完整统计数据
   */
  async getFullStats(userId: string): Promise<TradeStats> {
    const trades = await this.getRecentTrades(userId, 1000); // 查询更多数据用于统计

    if (trades.length === 0) {
      return {
        totalTrades: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
        avgWinPnl: 0,
        avgLossPnl: 0,
        profitFactor: 0,
        sharpeRatio: 0,
        bestSymbol: null,
        worstSymbol: null,
      };
    }

    // 分类盈亏交易
    const wins = trades.filter(t => t.pnl > 0);
    const losses = trades.filter(t => t.pnl < 0);

    // 基础统计
    const totalTrades = trades.length;
    const winCount = wins.length;
    const lossCount = losses.length;
    const winRate = totalTrades > 0 ? (winCount / totalTrades) * 100 : 0;

    // 平均盈亏
    const avgWinPnl = winCount > 0
      ? wins.reduce((sum, t) => sum + t.pnl, 0) / winCount
      : 0;

    const avgLossPnl = lossCount > 0
      ? losses.reduce((sum, t) => sum + t.pnl, 0) / lossCount
      : 0;

    // 盈亏比 (Profit Factor)
    const totalWinPnl = wins.reduce((sum, t) => sum + t.pnl, 0);
    const totalLossPnl = Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0));
    const profitFactor = totalLossPnl > 0 ? totalWinPnl / totalLossPnl : 0;

    // 夏普比率 (Sharpe Ratio)
    const returns = trades.map(t => t.pnlPercent);
    const sharpeRatio = this.calculateSharpeRatio(returns);

    // 最佳/最差交易对
    const symbolStats = this.calculateSymbolStats(trades);
    const bestSymbol = symbolStats.length > 0 ? symbolStats[0].symbol : null;
    const worstSymbol = symbolStats.length > 0
      ? symbolStats[symbolStats.length - 1].symbol
      : null;

    return {
      totalTrades,
      wins: winCount,
      losses: lossCount,
      winRate,
      avgWinPnl,
      avgLossPnl,
      profitFactor,
      sharpeRatio,
      bestSymbol,
      worstSymbol,
    };
  }

  /**
   * 计算夏普比率
   * Sharpe Ratio = mean(returns) / stddev(returns) * sqrt(252)
   */
  private calculateSharpeRatio(returns: number[]): number {
    if (returns.length < 2) return 0;

    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    const stddev = Math.sqrt(variance);

    if (stddev === 0) return 0;

    // 年化 (假设每日交易)
    const sharpe = (mean / stddev) * Math.sqrt(252);
    return Math.round(sharpe * 100) / 100;
  }

  /**
   * 按交易对统计
   */
  private calculateSymbolStats(trades: TradeRecord[]): Array<{ symbol: string; winRate: number; pnl: number }> {
    const symbolMap = new Map<string, { wins: number; total: number; pnl: number }>();

    trades.forEach(t => {
      const stat = symbolMap.get(t.symbol) || { wins: 0, total: 0, pnl: 0 };
      stat.total += 1;
      stat.pnl += t.pnl;
      if (t.pnl > 0) stat.wins += 1;
      symbolMap.set(t.symbol, stat);
    });

    return Array.from(symbolMap.entries())
      .map(([symbol, stat]) => ({
        symbol,
        winRate: stat.total > 0 ? (stat.wins / stat.total) * 100 : 0,
        pnl: stat.pnl,
      }))
      .sort((a, b) => b.pnl - a.pnl); // 按盈亏排序
  }

  /**
   * 生成性能提示
   * 基于最近的交易表现，给出风险控制建议
   */
  async getPerformanceHints(userId: string): Promise<string[]> {
    const trades = await this.getRecentTrades(userId, 10);

    if (trades.length === 0) {
      return ['暂无历史交易数据'];
    }

    const hints: string[] = [];
    const recent3 = trades.slice(0, 3);
    const stats = await this.getFullStats(userId);

    // 检查连续亏损
    if (recent3.length >= 3 && recent3.every(t => t.pnl < 0)) {
      hints.push('最近连续亏损，请更加保守，降低仓位');
    }

    // 检查连续盈利
    if (recent3.length >= 3 && recent3.every(t => t.pnl > 0)) {
      hints.push('保持当前策略节奏，但注意不要过度自信');
    }

    // 检查胜率
    if (stats.winRate < 40 && stats.totalTrades >= 5) {
      hints.push('胜率偏低，请反思交易逻辑，考虑减少交易频率');
    }

    // 检查盈亏比
    if (stats.profitFactor < 1 && stats.totalTrades >= 5) {
      hints.push('盈亏比不佳，需要提高止盈/止损策略的精准度');
    }

    // 检查夏普比率
    if (stats.sharpeRatio < 0.5 && stats.totalTrades >= 10) {
      hints.push('风险调整后收益偏低，建议优化风险控制');
    }

    if (hints.length === 0 && stats.totalTrades >= 5) {
      hints.push('交易表现稳定，继续保持');
    }

    return hints;
  }

  /**
   * 格式化交易历史为 Prompt 注入内容
   * 用于 P3 自学习：将历史表现注入到 AI 辩论 Prompt 中
   */
  async formatTradeHistoryForPrompt(userId: string): Promise<string> {
    const trades = await this.getRecentTrades(userId, 10);

    if (trades.length === 0) {
      return '';
    }

    const stats = await this.getFullStats(userId);
    const hints = await this.getPerformanceHints(userId);

    // 格式化统计摘要
    const summary = `=== 近期交易表现 ===
最近${trades.length}笔: ${stats.wins}胜${stats.losses}负 (胜率${stats.winRate.toFixed(1)}%)
平均盈亏比: ${stats.profitFactor.toFixed(1)}:1
Sharpe Ratio: ${stats.sharpeRatio.toFixed(2)}
最佳: ${stats.bestSymbol || 'N/A'}
最差: ${stats.worstSymbol || 'N/A'}
[性能提示: ${hints.join('; ')}]`;

    // 格式化最近3笔交易
    const recent3 = trades.slice(0, 3);
    const recentList = recent3.map((t, i) => {
      const timeAgo = this.formatTimeAgo(t.closedAt);
      const pnlSign = t.pnl >= 0 ? '+' : '';
      return `${i + 1}. ${t.symbol} ${t.side.toUpperCase()} ${pnlSign}${t.pnlPercent.toFixed(1)}% (${timeAgo})`;
    }).join('\n');

    return `${summary}

=== 最近3笔交易 ===
${recentList}`;
  }

  /**
   * 相对时间格式化
   */
  private formatTimeAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) {
      return `${diffMins}分钟前`;
    } else if (diffHours < 24) {
      return `${diffHours}小时前`;
    } else if (diffDays < 30) {
      return `${diffDays}天前`;
    } else {
      return `${Math.floor(diffDays / 30)}个月前`;
    }
  }
}
