import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

// ========================= 类型定义 =========================

export interface MemoryEntry {
  id: string;
  sceneText: string;
  action: string;
  symbol: string;
  pnl: number | null;
  pnlPercent: number | null;
  isWin: boolean | null;
  lesson: string | null;
  score?: number; // BM25 匹配分数
}

interface MarketSceneData {
  symbol: string;
  timeframe: string;
  rsi?: number | null;
  macdTrend?: string; // bullish, bearish, neutral
  emaTrend?: string; // above, below, cross
  atr?: number | null;
  volumeTrend?: string; // high, low, normal
  fundingRate?: number | null;
  priceChange?: number | null; // 价格变化百分比
}

// ========================= BM25 算法 =========================

/**
 * BM25 文本相似度算法（纯 TypeScript，无外部依赖）
 *
 * 公式：score = Σ IDF(qi) * (tf(qi,D) * (k1+1)) / (tf(qi,D) + k1 * (1 - b + b * |D|/avgdl))
 * 参数：k1=1.5, b=0.75（标准值）
 */
class BM25 {
  private k1 = 1.5;
  private b = 0.75;
  private documents: string[][] = [];
  private avgdl = 0;
  private docCount = 0;
  private idfCache: Map<string, number> = new Map();

  /**
   * 用文档集合初始化 BM25
   */
  init(docs: string[]): void {
    this.documents = docs.map((d) => this.tokenize(d));
    this.docCount = this.documents.length;
    if (this.docCount === 0) {
      this.avgdl = 0;
      return;
    }
    const totalLen = this.documents.reduce((sum, d) => sum + d.length, 0);
    this.avgdl = totalLen / this.docCount;
    this.idfCache.clear();
  }

  /**
   * 对 query 计算每个文档的 BM25 分数
   */
  search(query: string, topK: number = 5): Array<{ index: number; score: number }> {
    if (this.docCount === 0) return [];

    const queryTokens = this.tokenize(query);
    const scores: Array<{ index: number; score: number }> = [];

    for (let i = 0; i < this.documents.length; i++) {
      const doc = this.documents[i];
      let score = 0;

      for (const qt of queryTokens) {
        const idf = this.getIDF(qt);
        const tf = doc.filter((t) => t === qt).length;
        const numerator = tf * (this.k1 + 1);
        const denominator =
          tf + this.k1 * (1 - this.b + this.b * (doc.length / this.avgdl));
        score += idf * (numerator / denominator);
      }

      if (score > 0) {
        scores.push({ index: i, score });
      }
    }

    // 按分数降序排列，取前 topK
    scores.sort((a, b) => b.score - a.score);
    return scores.slice(0, topK);
  }

  /**
   * 计算逆文档频率 (IDF)
   */
  private getIDF(term: string): number {
    if (this.idfCache.has(term)) {
      return this.idfCache.get(term)!;
    }

    const docsWithTerm = this.documents.filter((d) => d.includes(term)).length;
    // 标准 BM25 IDF 公式（加 0.5 平滑）
    const idf = Math.log(
      (this.docCount - docsWithTerm + 0.5) / (docsWithTerm + 0.5) + 1,
    );
    this.idfCache.set(term, idf);
    return idf;
  }

  /**
   * 分词：按空格和特殊字符分割
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fff_./%-]+/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 0);
  }
}

// ========================= 服务实现 =========================

@Injectable()
export class AiMemoryService {
  private readonly logger = new Logger(AiMemoryService.name);
  private readonly bm25 = new BM25();

  /** 每用户每角色最大记忆数（超出后 FIFO 淘汰最旧的） */
  private readonly MAX_MEMORIES_PER_ROLE = 100;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 将市场数据编码为场景文本（用于 BM25 匹配）
   *
   * 格式示例："BTC/USDT 4h RSI=65 MACD_bullish EMA_above ATR=450 volume_high funding_positive"
   */
  buildSceneText(data: MarketSceneData): string {
    const parts: string[] = [];

    parts.push(data.symbol);
    parts.push(data.timeframe);

    if (data.rsi != null) {
      parts.push(`RSI=${Math.round(data.rsi)}`);
      if (data.rsi > 70) parts.push('RSI_overbought');
      else if (data.rsi < 30) parts.push('RSI_oversold');
      else if (data.rsi > 50) parts.push('RSI_bullish');
      else parts.push('RSI_bearish');
    }

    if (data.macdTrend) parts.push(`MACD_${data.macdTrend}`);
    if (data.emaTrend) parts.push(`EMA_${data.emaTrend}`);

    if (data.atr != null) {
      parts.push(`ATR=${Math.round(data.atr)}`);
    }

    if (data.volumeTrend) parts.push(`volume_${data.volumeTrend}`);

    if (data.fundingRate != null) {
      if (data.fundingRate > 0.0005) parts.push('funding_high_positive');
      else if (data.fundingRate > 0) parts.push('funding_positive');
      else if (data.fundingRate < -0.0005) parts.push('funding_high_negative');
      else parts.push('funding_negative');
    }

    if (data.priceChange != null) {
      if (data.priceChange > 3) parts.push('price_surge');
      else if (data.priceChange > 1) parts.push('price_up');
      else if (data.priceChange < -3) parts.push('price_crash');
      else if (data.priceChange < -1) parts.push('price_down');
      else parts.push('price_flat');
    }

    return parts.join(' ');
  }

  /**
   * 平仓后存储交易记忆
   *
   * @param role 可选角色标识，用于 5 路独立 BM25 记忆（产品 A）
   *   不传 role 则为通用记忆（产品 B / 向后兼容）
   */
  async storeMemory(params: {
    userId: string;
    analysisId: string;
    symbol: string;
    sceneText: string;
    action: string;
    pnl: number;
    pnlPercent: number;
    role?: string; // bull | bear | trader | invest_judge | risk_manager | general
  }): Promise<void> {
    const isWin = params.pnl > 0;

    // 自动生成教训
    let lesson: string | null = null;
    if (!isWin && Math.abs(params.pnlPercent) > 5) {
      lesson = `亏损 ${params.pnlPercent.toFixed(1)}%，该场景下 ${params.action} 效果不佳`;
    } else if (isWin && params.pnlPercent > 10) {
      lesson = `盈利 ${params.pnlPercent.toFixed(1)}%，该场景下 ${params.action} 效果很好`;
    }

    try {
      await this.prisma.aiMemory.create({
        data: {
          userId: params.userId,
          analysisId: params.analysisId,
          symbol: params.symbol,
          sceneText: params.role ? `[role:${params.role}] ${params.sceneText}` : params.sceneText,
          action: params.action,
          pnl: new Decimal(params.pnl),
          pnlPercent: new Decimal(params.pnlPercent),
          isWin,
          lesson,
        },
      });
      this.logger.log(
        `记忆存储: ${params.symbol} ${params.action} → ${isWin ? '盈' : '亏'} ${params.pnlPercent.toFixed(1)}%`,
      );

      // FIFO 淘汰：每用户每角色最多保留 MAX_MEMORIES_PER_ROLE 条
      await this.evictOldMemories(params.userId, params.role);
    } catch (error) {
      this.logger.warn(`记忆存储失败: ${error.message}`);
    }
  }

  /**
   * BM25 检索最相似的历史记忆
   *
   * @param role 可选角色过滤，只检索该角色的记忆
   *   通过 sceneText 中的 [role:xxx] 前缀过滤
   *   不传则检索所有记忆（向后兼容）
   */
  async retrieveSimilar(
    currentScene: string,
    userId: string,
    topK: number = 5,
    role?: string,
  ): Promise<MemoryEntry[]> {
    try {
      // 查询该用户的所有记忆
      const whereClause: any = { userId };

      // 如果指定了角色，使用 sceneText 前缀过滤
      if (role) {
        whereClause.sceneText = { startsWith: `[role:${role}]` };
      }

      const memories = await this.prisma.aiMemory.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        take: 200, // 限制最多 200 条，避免性能问题
      });

      if (memories.length === 0) return [];

      // BM25 初始化并检索
      this.bm25.init(memories.map((m) => m.sceneText));
      const results = this.bm25.search(currentScene, topK);

      return results.map((r) => {
        const mem = memories[r.index];
        return {
          id: mem.id,
          sceneText: mem.sceneText,
          action: mem.action,
          symbol: mem.symbol,
          pnl: mem.pnl ? Number(mem.pnl) : null,
          pnlPercent: mem.pnlPercent ? Number(mem.pnlPercent) : null,
          isWin: mem.isWin,
          lesson: mem.lesson,
          score: r.score,
        };
      });
    } catch (error) {
      this.logger.warn(`记忆检索失败: ${error.message}`);
      return [];
    }
  }

  /**
   * 加权淘汰：优先删除亏损记忆，保留盈利记忆更久
   *
   * 策略：
   * 1. 先删亏损记忆（isWin=false），按 createdAt asc
   * 2. 亏损不够删时，再删最旧的盈利记忆
   * 这样盈利的交易经验会比亏损经验存活更久
   */
  private async evictOldMemories(userId: string, role?: string): Promise<void> {
    try {
      const whereClause: any = { userId };
      if (role) {
        whereClause.sceneText = { startsWith: `[role:${role}]` };
      }

      const count = await this.prisma.aiMemory.count({ where: whereClause });

      if (count <= this.MAX_MEMORIES_PER_ROLE) return;

      const excess = count - this.MAX_MEMORIES_PER_ROLE;

      // 第 1 轮：优先淘汰亏损记忆（isWin=false 或 null）
      const losingMemories = await this.prisma.aiMemory.findMany({
        where: { ...whereClause, OR: [{ isWin: false }, { isWin: null }] },
        orderBy: { createdAt: 'asc' },
        take: excess,
        select: { id: true },
      });

      const toDelete = losingMemories.map((m) => m.id);

      // 第 2 轮：亏损记忆不够删时，再从最旧的盈利记忆中补
      if (toDelete.length < excess) {
        const remaining = excess - toDelete.length;
        const oldWinning = await this.prisma.aiMemory.findMany({
          where: { ...whereClause, isWin: true, id: { notIn: toDelete } },
          orderBy: { createdAt: 'asc' },
          take: remaining,
          select: { id: true },
        });
        toDelete.push(...oldWinning.map((m) => m.id));
      }

      if (toDelete.length > 0) {
        await this.prisma.aiMemory.deleteMany({
          where: { id: { in: toDelete } },
        });
        this.logger.log(
          `记忆淘汰: 用户=${userId}, 角色=${role || 'general'}, 删除 ${toDelete.length} 条（优先淘汰亏损记忆）`,
        );
      }
    } catch (error) {
      this.logger.warn(`记忆淘汰失败: ${error.message}`);
    }
  }

  /**
   * 格式化记忆为 prompt 注入文本
   */
  formatForPrompt(memories: MemoryEntry[]): string {
    if (memories.length === 0) return '';

    const lines = memories.map((m, i) => {
      const result = m.isWin ? `盈利 ${m.pnlPercent?.toFixed(1)}%` : `亏损 ${m.pnlPercent?.toFixed(1)}%`;
      const lessonPart = m.lesson ? ` (教训: ${m.lesson})` : '';
      return `${i + 1}. ${m.symbol} ${m.sceneText.substring(0, 80)} → 决策: ${m.action}, 结果: ${result}${lessonPart}`;
    });

    return `=== 相似历史场景 (BM25 匹配) ===\n${lines.join('\n')}`;
  }
}
