import {
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AirdropService } from './airdrop.service';
import { QueryAirdropDto } from './dto/airdrop.dto';

@Controller('airdrop')
@UseGuards(JwtAuthGuard)
export class AirdropController {
  constructor(private readonly airdropService: AirdropService) {}

  /**
   * 获取 HOOT 余额
   * GET /airdrop/balance
   */
  @Get('balance')
  async getBalance(@CurrentUser('id') userId: string) {
    return this.airdropService.getBalance(userId);
  }

  /**
   * 获取空投历史
   * GET /airdrop/history
   */
  @Get('history')
  async getHistory(
    @CurrentUser('id') userId: string,
    @Query() query: QueryAirdropDto,
  ) {
    return this.airdropService.getHistory(userId, query);
  }

  /**
   * 每日签到
   * POST /airdrop/checkin
   */
  @Post('checkin')
  @HttpCode(HttpStatus.OK)
  async checkin(@CurrentUser('id') userId: string) {
    return this.airdropService.checkin(userId);
  }

  /**
   * 获取签到状态
   * GET /airdrop/checkin/status
   */
  @Get('checkin/status')
  async getCheckinStatus(@CurrentUser('id') userId: string) {
    return this.airdropService.getCheckinStatus(userId);
  }

  /**
   * 获取任务列表
   * GET /airdrop/tasks
   */
  @Get('tasks')
  async getTaskList(@CurrentUser('id') userId: string) {
    return this.airdropService.getTaskList(userId);
  }

}
