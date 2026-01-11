import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ExchangeLinksService } from './exchange-links.service';
import { CreateExchangeLinkDto, UpdateExchangeLinkDto } from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';

@ApiTags('交易所推广链接')
@Controller('exchange-links')
export class ExchangeLinksController {
  constructor(private readonly exchangeLinksService: ExchangeLinksService) {}

  /**
   * 获取所有启用的交易所链接（公开接口）
   * GET /api/exchange-links
   */
  @Get()
  @ApiOperation({ summary: '获取所有启用的交易所链接' })
  async getActiveLinks() {
    const links = await this.exchangeLinksService.getActiveLinks();
    return {
      code: 0,
      message: 'success',
      data: links,
    };
  }

  /**
   * 获取所有交易所链接（管理员）
   * GET /api/exchange-links/all
   */
  @Get('all')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取所有交易所链接（管理员）' })
  async getAllLinks() {
    const links = await this.exchangeLinksService.getAllLinks();
    return {
      code: 0,
      message: 'success',
      data: links,
    };
  }

  /**
   * 创建交易所链接（管理员）
   * POST /api/exchange-links
   */
  @Post()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '创建交易所链接' })
  async createLink(@Body() dto: CreateExchangeLinkDto) {
    const link = await this.exchangeLinksService.createLink(dto);
    return {
      code: 0,
      message: '创建成功',
      data: link,
    };
  }

  /**
   * 更新交易所链接（管理员）
   * PUT /api/exchange-links/:id
   */
  @Put(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '更新交易所链接' })
  async updateLink(@Param('id') id: string, @Body() dto: UpdateExchangeLinkDto) {
    const link = await this.exchangeLinksService.updateLink(id, dto);
    return {
      code: 0,
      message: '更新成功',
      data: link,
    };
  }

  /**
   * 删除交易所链接（管理员）
   * DELETE /api/exchange-links/:id
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '删除交易所链接' })
  async deleteLink(@Param('id') id: string) {
    await this.exchangeLinksService.deleteLink(id);
    return {
      code: 0,
      message: '删除成功',
    };
  }
}
