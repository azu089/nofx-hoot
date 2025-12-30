import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { BackupsService } from './backups.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

/**
 * 备份控制器
 * 路由前缀: /api/backups
 */
@ApiTags('备份管理')
@Controller('backups')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BackupsController {
  constructor(private readonly backupsService: BackupsService) {}

  /**
   * 获取我的备份列表
   * GET /api/backups
   */
  @Get()
  @ApiOperation({ summary: '获取备份列表' })
  @ApiResponse({ status: 200, description: '成功获取备份列表' })
  async getMyBackups(@CurrentUser('sub') userId: string) {
    const backups = await this.backupsService.getBackupsByUser(userId);
    return {
      code: 0,
      message: 'success',
      data: backups,
    };
  }

  /**
   * 手动触发实例备份
   * POST /api/backups/instance/:id
   */
  @Post('instance/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '手动备份实例' })
  @ApiResponse({ status: 200, description: '备份成功' })
  async backupInstance(@Param('id') instanceId: string) {
    // 这里简化处理，实际应该从 VPS 获取数据
    const result = await this.backupsService.backupInstance(instanceId, {
      tradesData: Buffer.from('manual_backup_trades'),
      configData: Buffer.from('{"manual": true}'),
    });

    return {
      code: 0,
      message: '备份成功',
      data: result,
    };
  }

  /**
   * 恢复备份到实例
   * POST /api/backups/restore/:instanceId
   */
  @Post('restore/:instanceId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '恢复备份到实例' })
  @ApiResponse({ status: 200, description: '恢复成功' })
  async restoreToInstance(
    @CurrentUser('sub') userId: string,
    @Param('instanceId') instanceId: string,
  ) {
    const result = await this.backupsService.restoreInstance(instanceId, userId);

    return {
      code: 0,
      message: result.restored ? '恢复成功' : '没有可恢复的备份',
      data: {
        restored: result.restored,
        backupId: result.backupId,
      },
    };
  }
}
