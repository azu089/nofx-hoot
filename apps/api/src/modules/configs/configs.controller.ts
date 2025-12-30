import {
  Controller,
  Get,
  Put,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ConfigsService } from './configs.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { UpdateConfigDto, BatchUpdateConfigDto, ConfigCategory } from './dto/config.dto';

/**
 * 配置中心控制器
 * 路由前缀: /api/configs
 */
@ApiTags('配置中心')
@Controller('configs')
export class ConfigsController {
  constructor(private readonly configsService: ConfigsService) {}

  /**
   * 获取公开配置（前端用，无需认证）
   */
  @Public()
  @Get('public')
  @ApiOperation({ summary: '获取公开配置' })
  @ApiResponse({ status: 200, description: '成功获取公开配置' })
  async getPublicConfigs() {
    return {
      code: 0,
      message: 'success',
      data: await this.configsService.getPublicConfigs(),
    };
  }
}

/**
 * 管理员配置控制器
 * 路由前缀: /api/admin/configs
 */
@ApiTags('Admin - 配置管理')
@ApiBearerAuth()
@Controller('admin/configs')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminConfigsController {
  constructor(private readonly configsService: ConfigsService) {}

  /**
   * 获取所有配置
   */
  @Get()
  @ApiOperation({ summary: '获取所有配置' })
  @ApiQuery({ name: 'category', required: false, description: '分类过滤' })
  @ApiResponse({ status: 200, description: '成功获取配置列表' })
  async getAllConfigs(@Query('category') category?: ConfigCategory) {
    return {
      code: 0,
      message: 'success',
      data: await this.configsService.getAllConfigs(category),
    };
  }

  /**
   * 获取单个配置
   */
  @Get(':key')
  @ApiOperation({ summary: '获取单个配置' })
  @ApiResponse({ status: 200, description: '成功获取配置' })
  @ApiResponse({ status: 404, description: '配置不存在' })
  async getConfig(@Param('key') key: string) {
    return {
      code: 0,
      message: 'success',
      data: await this.configsService.getConfigDetail(key),
    };
  }

  /**
   * 更新配置
   */
  @Put(':key')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '更新配置' })
  @ApiResponse({ status: 200, description: '配置更新成功' })
  @ApiResponse({ status: 404, description: '配置不存在' })
  async updateConfig(
    @Param('key') key: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: UpdateConfigDto,
  ) {
    const updated = await this.configsService.updateConfig(
      key,
      dto.value,
      userId,
      { description: dto.description, isPublic: dto.isPublic },
    );

    return {
      code: 0,
      message: '配置更新成功',
      data: updated,
    };
  }

  /**
   * 批量更新配置
   */
  @Post('batch')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '批量更新配置' })
  @ApiResponse({ status: 200, description: '批量更新完成' })
  async batchUpdateConfigs(
    @CurrentUser('sub') userId: string,
    @Body() dto: BatchUpdateConfigDto,
  ) {
    const result = await this.configsService.batchUpdateConfigs(dto.configs, userId);

    return {
      code: 0,
      message: `更新完成: 成功 ${result.updated}, 失败 ${result.failed.length}`,
      data: result,
    };
  }

  /**
   * 初始化默认配置
   */
  @Post('init')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '初始化默认配置' })
  @ApiResponse({ status: 200, description: '初始化完成' })
  async initConfigs() {
    const result = await this.configsService.initDefaultConfigs();

    return {
      code: 0,
      message: `初始化完成: 创建 ${result.created}, 跳过 ${result.skipped}`,
      data: result,
    };
  }
}
