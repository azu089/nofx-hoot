import {
  Controller,
  Post,
  Get,
  Delete,
  Patch,
  Body,
  Param,
  Optional,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ApiKeysService } from './api-keys.service';
import { AdapterFactoryService } from '../exchange-adapters/adapter-factory.service';
import { CreateApiKeyDto, CreateDexCredentialDto, UpdateApiKeyDto } from './dto/api-key.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('api-keys')
@Controller('api-keys')
export class ApiKeysController {
  constructor(
    private apiKeysService: ApiKeysService,
    @Optional() private adapterFactory?: AdapterFactoryService,
  ) {}

  // 添加 API Key
  @Post()
  async create(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateApiKeyDto,
  ) {
    return this.apiKeysService.create(user.id, dto);
  }

  // 添加 DEX 凭证（钱包地址 + 私钥）
  @Post('dex')
  async createDex(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateDexCredentialDto,
  ) {
    return this.apiKeysService.createDexCredential(user.id, dto);
  }

  // 获取 API Key 列表
  @Get()
  async findAll(@CurrentUser() user: { id: string }) {
    return this.apiKeysService.findAll(user.id);
  }

  // 更新 API Key
  @Patch(':id')
  async update(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: UpdateApiKeyDto,
  ) {
    return this.apiKeysService.update(user.id, id, dto);
  }

  // 获取 API Key 关联的交易所余额（简化版，用于策略配置页面）
  // 注意：必须放在 :id 动态路由之前，避免被捕获
  @Get(':id/balance')
  async getBalance(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    const result = await this.apiKeysService.verifyApiKey(user.id, id);
    return {
      balance: result.totalUsdValue || 0,
      spotBalance: result.spotValue || 0,
      futuresBalance: result.futuresValue || 0,
      valid: result.valid,
    };
  }

  // 验证 API Key 并获取余额
  @Get(':id/verify')
  async verify(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.apiKeysService.verifyApiKey(user.id, id);
  }

  // 获取交易所真实盈亏统计（今日/周/月盈亏、未实现盈亏）
  @Get(':id/pnl-stats')
  async getPnlStats(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.apiKeysService.getExchangePnlStats(user.id, id);
  }

  // 删除 API Key
  @Delete(':id')
  async delete(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    await this.apiKeysService.delete(user.id, id);
    // 立即失效适配器缓存，确保已禁用/删除的 Key 不再被使用
    await this.adapterFactory?.invalidateAdapter(user.id, id);
    return { message: 'API Key 已删除' };
  }
}
