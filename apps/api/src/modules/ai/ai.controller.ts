import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AiService } from './ai.service';
import { GenerateStrategyDto, AnalyzeTradesDto, InterpretTradeDto } from './dto/generate-strategy.dto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('AI')
@Controller('ai')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AiController {
  constructor(private readonly aiService: AiService) {}

  /**
   * 生成交易策略
   */
  @Post('generate-strategy')
  @ApiOperation({ summary: '生成交易策略', description: '使用 AI 生成 Freqtrade 策略代码' })
  async generateStrategy(@Request() req: any, @Body() dto: GenerateStrategyDto) {
    const result = await this.aiService.generateStrategy(req.user.sub, dto);
    return {
      code: 0,
      message: '策略生成成功',
      data: result,
    };
  }

  /**
   * 分析交易记录
   */
  @Post('analyze-trades')
  @ApiOperation({ summary: '分析交易记录', description: 'AI 分析用户交易数据并给出建议' })
  async analyzeTrades(@Request() req: any, @Body() dto: AnalyzeTradesDto) {
    const result = await this.aiService.analyzeTrades(req.user.sub, dto);
    return {
      code: 0,
      message: '分析完成',
      data: result,
    };
  }

  /**
   * 解读单笔持仓（智能投顾）
   */
  @Post('interpret-trade')
  @ApiOperation({ summary: '解读单笔持仓', description: 'AI 解读单笔交易的触发信号、趋势判断和执行动作' })
  async interpretTrade(@Request() req: any, @Body() dto: InterpretTradeDto) {
    const result = await this.aiService.interpretTrade(req.user.sub, dto);
    return {
      code: 0,
      message: '解读完成',
      data: result,
    };
  }

  /**
   * 查询生成配额
   */
  @Get('generation-quota')
  @ApiOperation({ summary: '查询生成配额', description: '查询本月剩余 AI 生成配额' })
  async getQuota(@Request() req: any) {
    const quota = await this.aiService.checkQuota(req.user.sub);
    return {
      code: 0,
      message: 'success',
      data: quota,
    };
  }

  /**
   * 获取生成历史
   */
  @Get('generation-history')
  @ApiOperation({ summary: '获取生成历史', description: '查询 AI 生成记录' })
  async getHistory(
    @Request() req: any,
    @Query('type') type?: 'strategy' | 'analysis',
    @Query('limit') limit?: number,
  ) {
    const history = await this.aiService.getGenerationHistory(
      req.user.sub,
      type,
      limit || 10,
    );
    return {
      code: 0,
      message: 'success',
      data: history,
    };
  }
}
