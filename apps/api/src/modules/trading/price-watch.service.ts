import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
  Optional,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';
import { AdapterFactoryService } from '../exchange-adapters/adapter-factory.service';
import { TradingGateway } from '../../gateways/trading.gateway';
import { BinanceWsProvider } from './exchange-ws/binance-ws.provider';
import { OkxWsProvider } from './exchange-ws/okx-ws.provider';
import { BybitWsProvider } from './exchange-ws/bybit-ws.provider';
import { GateWsProvider } from './exchange-ws/gate-ws.provider';
import { BitgetWsProvider } from './exchange-ws/bitget-ws.provider';
import { RestFallbackProvider } from './exchange-ws/rest-fallback.provider';
import { IWsProvider, MarkPriceTick, TickCallback } from './exchange-ws/ws-provider.interface';
import { PositionMonitorService } from './position-monitor.service';

/** 订阅时传入的持仓信息 */
export interface WatchParams {
  positionId: string;
  userId: string;
  apiKeyId: string;
  symbol: string;        // 归一化格式 'BTC/USDT:USDT'
  exchangeType: string;  // 'binance'|'okx'|'bybit'|'gate'|'bitget'|'lighter'|'aster'等
  side: 'long' | 'short';
  entryPrice: number;
  amount: number;
  margin: number;
  leverage: number;
  riskConfig: {
    peakProfitThreshold: number;    // 峰值盈利阈值（%），超过此值才启动回撤保护
    peakDrawdownThreshold: number;  // 从峰值回撤多少 % 触发平仓
    absoluteLossThreshold: number;  // 绝对亏损阈值（%），负数表示亏损
    stopLossPercent?: number;       // 止损（%）
    takeProfitPercent?: number;     // 止盈（%）
    trailingStopActivation?: number;// 移动止损激活盈利（%）
    trailingStopCallback?: number;  // 移动止损回撤（%）
  };
  storedPeakPnlPct?: number;    // 从 DB 恢复的历史峰值（重启安全）
  storedHighWaterMark?: number; // 从 DB 恢复的高水位
}

/** 内存中的运行时状态（不写 DB，由节流任务定期落盘） */
interface WatchState {
  params: WatchParams;
  peakPnlPct: number;       // 峰值盈利%（单调递增）
  hwm: number;              // highWaterMark（单调递增，只记正值）
  trailingActivated: boolean;
  trailingPeakPrice: number; // 移动止损追踪最高/最低价
  closing: boolean;          // 正在平仓（去重锁）
  lastDbSync: number;        // 上次写 DB 的 timestamp（ms）
  lastMarkPrice: number;     // 最近一次 markPrice（调试用）
}

/**
 * PriceWatchService — 平台级实时风控核心
 *
 * 统一管理所有 AI 持仓的 WebSocket markPrice 订阅。
 * 每次价格推送（~100ms）执行全套风控检查：
 *   1. 绝对亏损保护
 *   2. 峰值回撤止盈（Peak-Drawdown）
 *   3. 止损 / 止盈
 *   4. 移动止损（Trailing Stop）
 *
 * 交易所优先 WS，DEX / WS 断线时降级到 REST 5s 轮询。
 * 30s BullMQ 保留为最终兜底（仅同步 not_found_on_exchange）。
 */
@Injectable()
export class PriceWatchService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PriceWatchService.name);

  // positionId → 运行时状态
  private states = new Map<string, WatchState>();

  // positionId → 回调函数（用于 unsubscribe）
  private callbacks = new Map<string, TickCallback>();

  // DB 批量写入节流（5s 一次）
  private dbSyncTimer?: NodeJS.Timeout;
  private readonly DB_SYNC_INTERVAL_MS = 5_000;

  // WS Provider 路由表
  private readonly wsProviders: Record<string, IWsProvider>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly binanceWs: BinanceWsProvider,
    private readonly okxWs: OkxWsProvider,
    private readonly bybitWs: BybitWsProvider,
    private readonly gateWs: GateWsProvider,
    private readonly bitgetWs: BitgetWsProvider,
    private readonly restFallback: RestFallbackProvider,
    @Optional() private readonly adapterFactory?: AdapterFactoryService,
    @Optional() @Inject(forwardRef(() => TradingGateway)) private readonly tradingGateway?: TradingGateway,
    @Optional() private readonly positionMonitor?: PositionMonitorService,
  ) {
    this.wsProviders = {
      binance: this.binanceWs,
      binanceusdm: this.binanceWs,
      okx: this.okxWs,
      bybit: this.bybitWs,
      gate: this.gateWs,
      gateio: this.gateWs,
      bitget: this.bitgetWs,
      // DEX 和未知交易所：REST fallback
      lighter: this.restFallback,
      aster: this.restFallback,
      hyperliquid: this.restFallback,
    };

    // REST Fallback：注入价格获取函数
    this.restFallback.setGetPriceFn(
      (symbol) => this.fetchPriceViaAdapter(symbol),
      5_000,
    );
  }

  // ==================== 生命周期 ====================

  async onModuleInit(): Promise<void> {
    // 启动时从 DB 恢复所有 open 持仓（重启安全）
    try {
      await this.restoreFromDb();
    } catch (e: any) {
      this.logger.error(`[PriceWatch] 启动恢复失败: ${e.message}`);
    }

    // 启动 DB 批量写入节流任务
    this.dbSyncTimer = setInterval(() => this.flushToDb(), this.DB_SYNC_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    if (this.dbSyncTimer) clearInterval(this.dbSyncTimer);
    // 最后一次落盘
    this.flushToDb().catch(() => {});

    this.binanceWs.destroy();
    this.okxWs.destroy();
    this.bybitWs.destroy();
    this.gateWs.destroy();
    this.bitgetWs.destroy();
    this.restFallback.destroy();
  }

  // ==================== 公开接口 ====================

  /**
   * 开仓后调用：订阅该持仓的实时价格监控
   */
  subscribe(params: WatchParams): void {
    if (this.states.has(params.positionId)) {
      this.logger.warn(`[PriceWatch] 已订阅: ${params.positionId}，跳过重复注册`);
      return;
    }

    const state: WatchState = {
      params,
      peakPnlPct: params.storedPeakPnlPct ?? 0,
      hwm: params.storedHighWaterMark ?? 0,
      trailingActivated: false,
      trailingPeakPrice: 0,
      closing: false,
      lastDbSync: Date.now(),
      lastMarkPrice: 0,
    };

    this.states.set(params.positionId, state);

    const callback: TickCallback = (tick) => this.onTick(params.positionId, tick);
    this.callbacks.set(params.positionId, callback);

    const provider = this.getProvider(params.exchangeType);
    provider.subscribe(params.symbol, callback);

    this.logger.log(
      `[PriceWatch] 开始监控: ${params.positionId} ${params.symbol} ${params.side} ` +
      `via ${params.exchangeType} (peak阈值:${params.riskConfig.peakProfitThreshold}% ` +
      `回撤阈值:${params.riskConfig.peakDrawdownThreshold}%)`,
    );
  }

  /**
   * 平仓后调用：取消该持仓的实时价格监控
   */
  unsubscribe(positionId: string): void {
    const state = this.states.get(positionId);
    const callback = this.callbacks.get(positionId);
    if (!state || !callback) return;

    const provider = this.getProvider(state.params.exchangeType);
    provider.unsubscribe(state.params.symbol, callback);

    this.states.delete(positionId);
    this.callbacks.delete(positionId);

    this.logger.log(`[PriceWatch] 停止监控: ${positionId} ${state.params.symbol}`);
  }

  /**
   * 查询当前监控中的持仓数
   */
  getWatchCount(): number {
    return this.states.size;
  }

  // ==================== 价格 Tick 处理（核心） ====================

  private onTick(positionId: string, tick: MarkPriceTick): void {
    const state = this.states.get(positionId);
    if (!state || state.closing) return;

    const { params } = state;
    const markPrice = tick.markPrice;
    state.lastMarkPrice = markPrice;

    // 计算未实现盈亏（%）
    const pnlPct = this.calcPnlPct(
      params.side, markPrice, params.entryPrice, params.margin,
      params.amount, params.leverage,
    );

    // 更新峰值（内存，单调递增）
    if (pnlPct > state.peakPnlPct) {
      state.peakPnlPct = pnlPct;
    }
    if (pnlPct > 0 && pnlPct > state.hwm) {
      state.hwm = pnlPct;
    }

    // ===== 风控检查（按优先级，一旦触发立即返回）=====

    // 1. 绝对亏损保护
    const absThreshold = params.riskConfig.absoluteLossThreshold;
    if (pnlPct < absThreshold) {
      void this.triggerClose(
        positionId,
        state,
        markPrice,
        `绝对亏损保护：当前亏损 ${pnlPct.toFixed(1)}% 超过 ${absThreshold}% 阈值 (杠杆 ${params.leverage}x)`,
        'absolute_loss',
      );
      return;
    }

    // 2. 峰值回撤保护（Peak-Drawdown）
    const { peakProfitThreshold, peakDrawdownThreshold } = params.riskConfig;
    if (state.peakPnlPct > peakProfitThreshold && state.peakPnlPct > 0) {
      const drawdownPct = ((state.peakPnlPct - pnlPct) / state.peakPnlPct) * 100;
      if (drawdownPct >= peakDrawdownThreshold) {
        void this.triggerClose(
          positionId,
          state,
          markPrice,
          `Peak-Drawdown 止盈：盈利 ${pnlPct.toFixed(1)}%，峰值 ${state.peakPnlPct.toFixed(1)}%，回撤 ${drawdownPct.toFixed(1)}% (阈值: >${peakProfitThreshold}%/≥${peakDrawdownThreshold}%)`,
          'peak_drawdown',
        );
        return;
      }
    }

    // 3. 止损
    const { stopLossPercent } = params.riskConfig;
    if (stopLossPercent && pnlPct <= -Math.abs(stopLossPercent)) {
      void this.triggerClose(
        positionId,
        state,
        markPrice,
        `止损触发：当前亏损 ${pnlPct.toFixed(1)}%，阈值 ${stopLossPercent}%`,
        'stop_loss',
      );
      return;
    }

    // 4. 止盈
    const { takeProfitPercent } = params.riskConfig;
    if (takeProfitPercent && pnlPct >= takeProfitPercent) {
      void this.triggerClose(
        positionId,
        state,
        markPrice,
        `止盈触发：当前盈利 ${pnlPct.toFixed(1)}%，阈值 ${takeProfitPercent}%`,
        'take_profit',
      );
      return;
    }

    // 5. 移动止损（Trailing Stop）
    const { trailingStopActivation, trailingStopCallback } = params.riskConfig;
    if (trailingStopActivation && trailingStopCallback) {
      this.checkTrailingStop(positionId, state, markPrice, pnlPct, trailingStopActivation, trailingStopCallback);
    }
  }

  private checkTrailingStop(
    positionId: string,
    state: WatchState,
    markPrice: number,
    pnlPct: number,
    activation: number,
    callback: number,
  ): void {
    const { side } = state.params;

    if (!state.trailingActivated) {
      if (pnlPct >= activation) {
        state.trailingActivated = true;
        state.trailingPeakPrice = markPrice;
        this.logger.log(`[PriceWatch] 移动止损已激活: ${positionId} @ ${markPrice}`);
      }
      return;
    }

    // 激活后：更新峰值价格
    if (side === 'long' && markPrice > state.trailingPeakPrice) {
      state.trailingPeakPrice = markPrice;
    } else if (side === 'short' && markPrice < state.trailingPeakPrice) {
      state.trailingPeakPrice = markPrice;
    }

    // 检查回撤
    let drawback: number;
    if (side === 'long') {
      drawback = state.trailingPeakPrice > 0
        ? ((state.trailingPeakPrice - markPrice) / state.trailingPeakPrice) * 100
        : 0;
    } else {
      drawback = state.trailingPeakPrice > 0
        ? ((markPrice - state.trailingPeakPrice) / state.trailingPeakPrice) * 100
        : 0;
    }

    if (drawback >= callback) {
      void this.triggerClose(
        positionId,
        state,
        markPrice,
        `移动止损触发：回撤 ${drawback.toFixed(1)}%，峰值价 ${state.trailingPeakPrice.toFixed(4)}`,
        'trailing_stop',
      );
    }
  }

  // ==================== 平仓执行 ====================

  private async triggerClose(
    positionId: string,
    state: WatchState,
    markPrice: number,
    reason: string,
    closeReason: string,
  ): Promise<void> {
    // 去重锁：防止并发双重平仓
    if (state.closing) return;
    state.closing = true;

    const { params } = state;
    this.logger.warn(
      `[PriceWatch] 触发平仓: ${positionId} ${params.symbol} ${params.side} | ${reason}`,
    );

    try {
      // 二次确认：DB 状态（防止 30s BullMQ 已先平仓）
      const dbPos = await this.prisma.position.findUnique({
        where: { id: positionId },
        select: { status: true, amount: true, apiKeyId: true },
      });

      if (!dbPos || dbPos.status !== 'open') {
        this.logger.warn(`[PriceWatch] ${positionId} DB 状态已非 open，跳过重复平仓`);
        this.unsubscribe(positionId);
        return;
      }

      if (!params.apiKeyId || !this.adapterFactory) {
        this.logger.warn(`[PriceWatch] ${positionId} 无 apiKeyId/adapterFactory，无法平仓`);
        return;
      }

      const adapter = await this.adapterFactory.createAdapter(params.userId, params.apiKeyId);
      const closeAmount = parseFloat(dbPos.amount?.toString() ?? params.amount.toString());

      let result;
      if (params.side === 'long') {
        result = await adapter.closeLong(params.symbol, closeAmount);
      } else {
        result = await adapter.closeShort(params.symbol, closeAmount);
      }

      // 计算退出价格（优先交易所返回的成交均价）
      let exitPrice = result.avgPrice || 0;
      if (exitPrice <= 0 && result.realizedPnl !== undefined) {
        exitPrice = params.side === 'long'
          ? params.entryPrice + result.realizedPnl / closeAmount
          : params.entryPrice - result.realizedPnl / closeAmount;
      }
      if (exitPrice <= 0) exitPrice = markPrice;

      // 计算 PnL
      let pnl: number;
      if (result.realizedPnl !== undefined && result.realizedPnl !== 0) {
        pnl = result.realizedPnl;
      } else if (params.side === 'long') {
        pnl = (exitPrice - params.entryPrice) * closeAmount;
      } else {
        pnl = (params.entryPrice - exitPrice) * closeAmount;
      }

      // 更新 DB（原子写入）
      await this.prisma.position.update({
        where: { id: positionId },
        data: {
          status: 'closed',
          exitPrice: new Decimal(exitPrice),
          closePrice: new Decimal(exitPrice),
          realizedPnl: new Decimal(pnl),
          closedAt: new Date(),
          closeReason,
          peakPnlPercent: null,  // 对齐 nofx：平仓后清除峰值缓存
          markPrice: new Decimal(markPrice),
          lastSyncAt: new Date(),
        },
      });

      // 清理 SL/TP 条件单
      adapter.cancelStopOrders(params.symbol).catch(() => {});

      // 推送前端 WS 通知
      this.tradingGateway?.sendPositionUpdate(params.userId, {
        id: positionId,
        symbol: params.symbol,
        side: params.side,
        entryPrice: params.entryPrice.toString(),
        amount: closeAmount.toString(),
        pnl: pnl.toFixed(4),
        status: 'closed',
        action: 'closed',
      });

      // TG 告警（fire-and-forget）
      this.sendTgAlert(params.userId, params.symbol, reason).catch(() => {});

      this.logger.log(
        `[PriceWatch] 平仓成功: ${positionId} ${params.symbol} PnL: ${pnl >= 0 ? '+' : ''}${pnl.toFixed(4)} USDT | ${reason}`,
      );
    } catch (e: any) {
      this.logger.error(`[PriceWatch] 平仓失败: ${positionId} - ${e.message}`);
      state.closing = false; // 失败时释放锁，允许重试
      return;
    }

    // 取消订阅
    this.unsubscribe(positionId);
    // 通知 PositionMonitorService 清理（防止空跑轮询）
    this.positionMonitor?.untrackPosition(positionId);
  }

  // ==================== DB 节流批量写入 ====================

  private async flushToDb(): Promise<void> {
    if (this.states.size === 0) return;

    const now = Date.now();
    const updates: Promise<any>[] = [];

    for (const [positionId, state] of this.states) {
      if (state.closing || now - state.lastDbSync < this.DB_SYNC_INTERVAL_MS - 500) continue;

      state.lastDbSync = now;
      updates.push(
        this.prisma.position.updateMany({
          where: { id: positionId, status: 'open' },
          data: {
            markPrice: state.lastMarkPrice > 0 ? new Decimal(state.lastMarkPrice) : undefined,
            highWaterMark: state.hwm > 0 ? new Decimal(state.hwm) : undefined,
            peakPnlPercent: state.peakPnlPct > 0 ? new Decimal(state.peakPnlPct) : undefined,
            lastSyncAt: new Date(),
          },
        }).catch((e: any) => {
          this.logger.debug(`[PriceWatch] DB flush 失败 ${positionId}: ${e.message}`);
        }),
      );
    }

    if (updates.length > 0) {
      await Promise.allSettled(updates);
    }
  }

  // ==================== 启动恢复 ====================

  private async restoreFromDb(): Promise<void> {
    const openPositions = await this.prisma.position.findMany({
      where: {
        status: 'open',
        source: { in: ['ai_analysis', 'ai_research', 'ai_strategy'] },
      },
      select: {
        id: true,
        userId: true,
        apiKeyId: true,
        symbol: true,
        side: true,
        entryPrice: true,
        amount: true,
        margin: true,
        leverage: true,
        exchange: true,
        peakPnlPercent: true,
        highWaterMark: true,
        aiStrategyId: true,
      },
    });

    if (openPositions.length === 0) return;

    // 批量查策略风控配置
    const strategyIds = [...new Set(openPositions.map(p => p.aiStrategyId).filter(Boolean))] as string[];
    const riskConfigMap = new Map<string, any>();
    if (strategyIds.length > 0) {
      const strategies = await this.prisma.aiStrategy.findMany({
        where: { id: { in: strategyIds } },
        select: { id: true, riskControlConfig: true },
      });
      for (const s of strategies) riskConfigMap.set(s.id, s.riskControlConfig);
    }

    let restored = 0;
    for (const pos of openPositions) {
      if (!pos.apiKeyId) continue;

      const riskCfg = pos.aiStrategyId ? riskConfigMap.get(pos.aiStrategyId) : null;
      const lev = pos.leverage ?? 1;

      this.subscribe({
        positionId: pos.id,
        userId: pos.userId,
        apiKeyId: pos.apiKeyId,
        symbol: pos.symbol,
        exchangeType: pos.exchange ?? 'binance',
        side: pos.side as 'long' | 'short',
        entryPrice: Number(pos.entryPrice),
        amount: Number(pos.amount),
        margin: Number(pos.margin ?? 0),
        leverage: lev,
        riskConfig: {
          peakProfitThreshold: riskCfg?.peakProfitThreshold ?? 5.0,
          peakDrawdownThreshold: riskCfg?.peakDrawdownThreshold ?? 40.0,
          absoluteLossThreshold: lev >= 5 ? -20 : -30,
          stopLossPercent: riskCfg?.stopLossPercent,
          takeProfitPercent: riskCfg?.takeProfitPercent,
          trailingStopActivation: riskCfg?.trailingStopActivation,
          trailingStopCallback: riskCfg?.trailingStopCallback,
        },
        storedPeakPnlPct: pos.peakPnlPercent ? Number(pos.peakPnlPercent) : undefined,
        storedHighWaterMark: pos.highWaterMark ? Number(pos.highWaterMark) : undefined,
      });
      restored++;
    }

    this.logger.log(`[PriceWatch] 启动恢复: ${restored} 个持仓已订阅实时监控`);
  }

  // ==================== 辅助方法 ====================

  private calcPnlPct(
    side: string,
    markPrice: number,
    entryPrice: number,
    margin: number,
    amount: number,
    leverage: number,
  ): number {
    if (margin <= 0) {
      // fallback: 用杠杆估算 margin
      const estMargin = (entryPrice * amount) / Math.max(leverage, 1);
      if (estMargin <= 0) return 0;
      const unrealized = side === 'long'
        ? (markPrice - entryPrice) * amount
        : (entryPrice - markPrice) * amount;
      return (unrealized / estMargin) * 100;
    }
    const unrealized = side === 'long'
      ? (markPrice - entryPrice) * amount
      : (entryPrice - markPrice) * amount;
    return (unrealized / margin) * 100;
  }

  private getProvider(exchangeType: string): IWsProvider {
    const key = exchangeType.toLowerCase();
    return this.wsProviders[key] ?? this.restFallback;
  }

  private async fetchPriceViaAdapter(symbol: string): Promise<number> {
    // REST fallback 用：通过 adapter 获取价格（DEX 场景）
    // 此处无 userId/apiKeyId，只能拿第一个活跃持仓的 adapter
    for (const state of this.states.values()) {
      if (state.params.symbol !== symbol) continue;
      if (!state.params.apiKeyId || !this.adapterFactory) continue;
      try {
        const adapter = await this.adapterFactory.createAdapter(
          state.params.userId, state.params.apiKeyId,
        );
        const price = await adapter.getMarketPrice(symbol);
        return price;
      } catch { /* 继续尝试下一个 */ }
    }
    return 0;
  }

  private async sendTgAlert(userId: string, symbol: string, reason: string): Promise<void> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { telegramId: true },
      });
      if (!user?.telegramId) return;

      const tgBotApiUrl = process.env.TG_BOT_API_URL || 'http://localhost:4002';
      await fetch(`${tgBotApiUrl}/notify-ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramId: user.telegramId,
          type: 'alert',
          strategyName: symbol,
          drawdown: reason,
          action: 'closed',
        }),
      });
    } catch { /* 非致命 */ }
  }
}
