import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { GenerateStrategyDto, AnalyzeTradesDto } from './dto/generate-strategy.dto';
import OpenAI from 'openai';

/**
 * VIP 等级对应的月度生成配额
 */
const VIP_QUOTAS: Record<number, number> = {
  0: 3,   // 普通用户: 3次/月
  1: 10,  // VIP 1: 10次/月
  2: 30,  // VIP 2: 30次/月
  3: -1,  // VIP 3: 无限制
};

/**
 * 策略生成的系统提示词
 */
const STRATEGY_SYSTEM_PROMPT = `你是一个专业的量化交易策略专家，精通 Freqtrade 框架。
用户会描述他们想要的交易策略，你需要生成完整的、可运行的 Freqtrade 策略 Python 代码。

要求：
1. 代码必须继承 IStrategy 类
2. 必须实现 populate_indicators、populate_entry_trend、populate_exit_trend 方法
3. 使用 talib 或 pandas-ta 库计算技术指标
4. 代码必须有详细的中文注释
5. 必须设置合理的 minimal_roi、stoploss、trailing_stop 参数
6. 根据风险等级调整参数：
   - low: 止损 -5%，止盈 5-10%，低杠杆
   - medium: 止损 -10%，止盈 10-20%，中等杠杆
   - high: 止损 -15%，止盈 20%+，高杠杆

返回 JSON 格式：
{
  "name": "策略名称",
  "code": "完整的 Python 代码",
  "explanation": "策略逻辑解释（中文，200字以内）"
}`;

/**
 * 交易分析的系统提示词
 */
const ANALYSIS_SYSTEM_PROMPT = `你是一个专业的量化交易分析师，擅长分析交易数据并给出建议。
用户会提供他们近期的交易统计数据，你需要分析这些数据并给出专业的评价和建议。

分析维度：
1. 盈亏比分析
2. 交易频率分析
3. 持仓时间分析
4. 风险控制评估
5. 情绪稳定性评估

返回 JSON 格式：
{
  "summary": "总体评价（50字以内）",
  "strengths": ["优势1", "优势2"],
  "weaknesses": ["不足1", "不足2"],
  "suggestions": ["建议1", "建议2", "建议3"],
  "emotionalScore": 情绪得分1-100,
  "riskScore": 风险得分1-100
}`;

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private openai: OpenAI | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
      this.logger.log('OpenAI API 已初始化');
    } else {
      this.logger.warn('未配置 OPENAI_API_KEY，AI 功能将使用模拟模式');
    }
  }

  /**
   * 检查用户是否有足够的生成配额
   */
  async checkQuota(userId: string): Promise<{ remaining: number; limit: number }> {
    // 获取用户 VIP 等级
    const user = await this.prisma.client.users.findUnique({
      where: { id: userId },
      select: { vip_level: true },
    });

    const vipLevel = user?.vip_level || 0;
    const limit = VIP_QUOTAS[vipLevel] ?? VIP_QUOTAS[0];

    // VIP 3 无限制
    if (limit === -1) {
      return { remaining: -1, limit: -1 };
    }

    // 统计本月已使用次数
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const usedCount = await this.prisma.client.ai_generations.count({
      where: {
        user_id: userId,
        type: 'strategy',
        created_at: { gte: startOfMonth },
      },
    });

    return {
      remaining: Math.max(0, limit - usedCount),
      limit,
    };
  }

  /**
   * AI 生成策略代码
   */
  async generateStrategy(
    userId: string,
    dto: GenerateStrategyDto,
  ): Promise<{ name: string; code: string; explanation: string }> {
    // 检查配额
    const quota = await this.checkQuota(userId);
    if (quota.limit !== -1 && quota.remaining <= 0) {
      throw new BadRequestException(
        `本月 AI 生成配额已用完（${quota.limit}次/月），请升级 VIP 获取更多配额`,
      );
    }

    const userPrompt = `请生成一个交易策略：
描述：${dto.description}
风险等级：${dto.riskLevel}
${dto.tradingPair ? `交易对：${dto.tradingPair}` : ''}`;

    let result: { name: string; code: string; explanation: string };

    if (this.openai) {
      // 调用 OpenAI API
      try {
        const model = this.configService.get<string>('OPENAI_MODEL') || 'gpt-4';
        const response = await this.openai.chat.completions.create({
          model,
          messages: [
            { role: 'system', content: STRATEGY_SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.7,
          max_tokens: 4000,
          response_format: { type: 'json_object' },
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new Error('AI 返回内容为空');
        }

        result = JSON.parse(content);

        // 记录使用的 token 数
        const tokensUsed = response.usage?.total_tokens || 0;

        // 保存生成记录
        await this.prisma.client.ai_generations.create({
          data: {
            user_id: userId,
            type: 'strategy',
            input: JSON.stringify(dto),
            output: content,
            tokens_used: tokensUsed,
            model,
          },
        });

        this.logger.log(`用户 ${userId} 生成策略成功，消耗 ${tokensUsed} tokens`);
      } catch (error) {
        this.logger.error(`AI 生成策略失败: ${error.message}`);
        throw new BadRequestException('AI 服务暂时不可用，请稍后重试');
      }
    } else {
      // 模拟模式
      result = this.generateMockStrategy(dto);

      // 保存生成记录
      await this.prisma.client.ai_generations.create({
        data: {
          user_id: userId,
          type: 'strategy',
          input: JSON.stringify(dto),
          output: JSON.stringify(result),
          tokens_used: 0,
          model: 'mock',
        },
      });
    }

    return result;
  }

  /**
   * AI 分析交易记录
   */
  async analyzeTrades(
    userId: string,
    dto: AnalyzeTradesDto,
  ): Promise<{
    summary: string;
    strengths: string[];
    weaknesses: string[];
    suggestions: string[];
    emotionalScore: number;
    riskScore: number;
  }> {
    // 获取用户交易数据
    const days = parseInt(dto.timeRange);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const trades = await this.prisma.client.trade_history.findMany({
      where: {
        user_id: userId,
        created_at: { gte: startDate },
      },
      select: {
        pnl: true,
        pnl_percentage: true,
        side: true,
        created_at: true,
        closed_at: true,
      },
    });

    // 计算统计数据
    const stats = this.calculateTradeStats(trades);

    if (this.openai) {
      try {
        const model = this.configService.get<string>('OPENAI_MODEL') || 'gpt-4';
        const response = await this.openai.chat.completions.create({
          model,
          messages: [
            { role: 'system', content: ANALYSIS_SYSTEM_PROMPT },
            {
              role: 'user',
              content: `请分析以下交易数据（最近${dto.timeRange}）：
${JSON.stringify(stats, null, 2)}`,
            },
          ],
          temperature: 0.7,
          max_tokens: 1000,
          response_format: { type: 'json_object' },
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new Error('AI 返回内容为空');
        }

        const result = JSON.parse(content);

        // 保存分析记录
        await this.prisma.client.ai_generations.create({
          data: {
            user_id: userId,
            type: 'analysis',
            input: JSON.stringify({ timeRange: dto.timeRange, stats }),
            output: content,
            tokens_used: response.usage?.total_tokens || 0,
            model,
          },
        });

        return result;
      } catch (error) {
        this.logger.error(`AI 分析交易失败: ${error.message}`);
        throw new BadRequestException('AI 服务暂时不可用，请稍后重试');
      }
    } else {
      // 模拟模式
      return this.generateMockAnalysis(stats);
    }
  }

  /**
   * 获取生成历史
   */
  async getGenerationHistory(
    userId: string,
    type?: 'strategy' | 'analysis',
    limit = 10,
  ) {
    const where: any = { user_id: userId };
    if (type) {
      where.type = type;
    }

    return this.prisma.client.ai_generations.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: limit,
      select: {
        id: true,
        type: true,
        input: true,
        output: true,
        tokens_used: true,
        model: true,
        created_at: true,
      },
    });
  }

  /**
   * 计算交易统计数据
   */
  private calculateTradeStats(trades: any[]) {
    if (trades.length === 0) {
      return {
        totalTrades: 0,
        winRate: 0,
        totalPnl: 0,
        avgPnl: 0,
        maxWin: 0,
        maxLoss: 0,
        avgHoldingTime: 0,
        longRatio: 0,
      };
    }

    const wins = trades.filter((t) => parseFloat(t.pnl || '0') > 0);
    const losses = trades.filter((t) => parseFloat(t.pnl || '0') < 0);
    const longs = trades.filter((t) => t.side === 'buy' || t.side === 'long');

    const pnls = trades.map((t) => parseFloat(t.pnl || '0'));
    const totalPnl = pnls.reduce((a, b) => a + b, 0);

    // 计算平均持仓时间（小时）
    const holdingTimes = trades
      .filter((t) => t.closed_at)
      .map((t) => {
        const start = new Date(t.created_at).getTime();
        const end = new Date(t.closed_at).getTime();
        return (end - start) / (1000 * 60 * 60);
      });

    return {
      totalTrades: trades.length,
      winRate: (wins.length / trades.length) * 100,
      totalPnl: totalPnl.toFixed(2),
      avgPnl: (totalPnl / trades.length).toFixed(2),
      maxWin: Math.max(...pnls, 0).toFixed(2),
      maxLoss: Math.min(...pnls, 0).toFixed(2),
      avgHoldingTime:
        holdingTimes.length > 0
          ? (holdingTimes.reduce((a, b) => a + b, 0) / holdingTimes.length).toFixed(1)
          : 0,
      longRatio: ((longs.length / trades.length) * 100).toFixed(1),
    };
  }

  /**
   * 模拟生成策略（无 API Key 时使用）
   */
  private generateMockStrategy(dto: GenerateStrategyDto) {
    const riskParams = {
      low: { stoploss: -0.05, roi: { '0': 0.1 }, trailing: 0.02 },
      medium: { stoploss: -0.1, roi: { '0': 0.2 }, trailing: 0.05 },
      high: { stoploss: -0.15, roi: { '0': 0.3 }, trailing: 0.08 },
    };

    const params = riskParams[dto.riskLevel];

    return {
      name: `AI_${dto.riskLevel}_Strategy`,
      code: `# AI 生成的交易策略 - ${dto.description}
# 风险等级: ${dto.riskLevel}
# 生成时间: ${new Date().toISOString()}

from freqtrade.strategy import IStrategy
from pandas import DataFrame
import talib.abstract as ta

class AI${dto.riskLevel.charAt(0).toUpperCase() + dto.riskLevel.slice(1)}Strategy(IStrategy):
    """
    AI 生成的 ${dto.riskLevel} 风险策略
    描述: ${dto.description}
    """

    # 策略参数
    minimal_roi = ${JSON.stringify(params.roi)}
    stoploss = ${params.stoploss}
    trailing_stop = True
    trailing_stop_positive = ${params.trailing}

    # 时间周期
    timeframe = '5m'

    def populate_indicators(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        """计算技术指标"""
        # RSI 指标
        dataframe['rsi'] = ta.RSI(dataframe, timeperiod=14)

        # MACD 指标
        macd = ta.MACD(dataframe)
        dataframe['macd'] = macd['macd']
        dataframe['macdsignal'] = macd['macdsignal']

        # 布林带
        bollinger = ta.BBANDS(dataframe, timeperiod=20)
        dataframe['bb_upper'] = bollinger['upperband']
        dataframe['bb_lower'] = bollinger['lowerband']

        return dataframe

    def populate_entry_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        """定义入场条件"""
        dataframe.loc[
            (
                (dataframe['rsi'] < 30) &  # RSI 超卖
                (dataframe['close'] < dataframe['bb_lower']) &  # 价格低于布林带下轨
                (dataframe['macd'] > dataframe['macdsignal'])  # MACD 金叉
            ),
            'enter_long'] = 1

        return dataframe

    def populate_exit_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        """定义出场条件"""
        dataframe.loc[
            (
                (dataframe['rsi'] > 70) |  # RSI 超买
                (dataframe['close'] > dataframe['bb_upper'])  # 价格高于布林带上轨
            ),
            'exit_long'] = 1

        return dataframe
`,
      explanation: `这是一个基于 RSI、MACD 和布林带的 ${dto.riskLevel} 风险策略。
入场条件：RSI 低于 30（超卖）+ 价格低于布林带下轨 + MACD 金叉
出场条件：RSI 高于 70（超买）或价格高于布林带上轨
止损：${(params.stoploss * 100).toFixed(0)}%，移动止损：${(params.trailing * 100).toFixed(0)}%`,
    };
  }

  /**
   * 模拟分析结果（无 API Key 时使用）
   */
  private generateMockAnalysis(stats: any) {
    const winRate = parseFloat(stats.winRate) || 0;
    const avgPnl = parseFloat(stats.avgPnl) || 0;

    // 根据胜率和盈亏计算得分
    const emotionalScore = Math.min(100, Math.max(20, winRate + (avgPnl > 0 ? 20 : -10)));
    const riskScore = Math.min(100, Math.max(20, 100 - Math.abs(parseFloat(stats.maxLoss))));

    return {
      summary:
        stats.totalTrades === 0
          ? '暂无交易记录，建议先进行模拟交易积累经验'
          : winRate > 50
            ? `整体表现不错！${stats.totalTrades}笔交易，胜率${winRate.toFixed(1)}%`
            : `需要改进交易策略，当前胜率${winRate.toFixed(1)}%偏低`,
      strengths:
        stats.totalTrades === 0
          ? ['谨慎观望是好的开始']
          : ([
              winRate > 50 ? '胜率较高，选币能力不错' : null,
              avgPnl > 0 ? '整体盈利，风控意识良好' : null,
              parseFloat(stats.longRatio) > 70 ? '以做多为主，符合牛市特征' : null,
            ].filter((x): x is string => x !== null)),
      weaknesses:
        stats.totalTrades === 0
          ? ['缺乏实战经验']
          : ([
              winRate < 50 ? '胜率偏低，建议优化选币逻辑' : null,
              avgPnl < 0 ? '整体亏损，需要加强止损执行' : null,
              Math.abs(parseFloat(stats.maxLoss)) > 20 ? '单笔最大亏损过大，风控不足' : null,
            ].filter((x): x is string => x !== null)),
      suggestions: [
        '建议使用止损单，控制单笔亏损在 5% 以内',
        '分散投资，不要 all in 单一币种',
        '定期复盘交易记录，总结经验教训',
      ],
      emotionalScore: Math.round(emotionalScore),
      riskScore: Math.round(riskScore),
    };
  }
}
