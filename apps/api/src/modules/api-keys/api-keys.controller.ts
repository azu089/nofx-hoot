import {
  Controller,
  Post,
  Get,
  Delete,
  Patch,
  Body,
  Param,
} from '@nestjs/common';
import { ApiKeysService } from './api-keys.service';
import { CreateApiKeyDto, UpdateApiKeyDto } from './dto/api-key.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('api-keys')
export class ApiKeysController {
  constructor(private apiKeysService: ApiKeysService) {}

  // 添加 API Key
  @Post()
  async create(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateApiKeyDto,
  ) {
    return this.apiKeysService.create(user.id, dto);
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

  // 删除 API Key
  @Delete(':id')
  async delete(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    await this.apiKeysService.delete(user.id, id);
    return { message: 'API Key 已删除' };
  }

  // 验证 API Key 并获取余额
  @Get(':id/verify')
  async verify(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.apiKeysService.verifyApiKey(user.id, id);
  }
}
