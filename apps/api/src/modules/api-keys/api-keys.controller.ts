import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ApiKeysService } from './api-keys.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/dto/jwt-payload.dto';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

/**
 * API Keys 控制器
 * 路由前缀: /api/api-keys
 */
@ApiTags('api-keys')
@ApiBearerAuth('JWT-auth')
@Controller('api-keys')
@UseGuards(JwtAuthGuard)
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  /**
   * 绑定 API Key
   * POST /api/api-keys
   */
  @Post()
  @ApiOperation({ summary: '绑定交易所 API Key' })
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateApiKeyDto,
  ) {
    return this.apiKeysService.create(user.sub, dto);
  }

  /**
   * 获取所有 API Keys
   * GET /api/api-keys
   */
  @Get()
  @ApiOperation({ summary: '获取所有 API Keys' })
  async findAll(@CurrentUser() user: JwtPayload) {
    return this.apiKeysService.findAllByUserId(user.sub);
  }

  /**
   * 获取用户所有交易所余额
   * GET /api/api-keys/balances
   * 注意：此路由必须放在 :id 路由之前，避免被 :id 匹配
   */
  @Get('balances')
  @ApiOperation({ summary: '获取所有交易所余额' })
  async getBalances(@CurrentUser() user: JwtPayload) {
    return this.apiKeysService.getExchangeBalances(user.sub);
  }

  /**
   * 获取单个 API Key
   * GET /api/api-keys/:id
   */
  @Get(':id')
  @ApiOperation({ summary: '获取 API Key 详情' })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.apiKeysService.findById(id, user.sub);
  }

  /**
   * 删除 API Key
   * DELETE /api/api-keys/:id
   */
  @Delete(':id')
  @ApiOperation({ summary: '删除 API Key' })
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.apiKeysService.delete(id, user.sub);
    return { message: 'API Key 已删除' };
  }

  /**
   * 验证 API Key
   * POST /api/api-keys/:id/verify
   */
  @Post(':id/verify')
  @ApiOperation({ summary: '验证 API Key' })
  async verify(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.apiKeysService.verify(id, user.sub);
  }
}
