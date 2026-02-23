import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { PrismaService } from '../../prisma/prisma.service';

@ApiTags('config')
@Controller('config')
export class PublicConfigController {
  constructor(private prisma: PrismaService) {}

  /**
   * 获取 PWA 安装配置（公开接口）
   * GET /config/pwa
   */
  @Public()
  @Get('pwa')
  async getPwaConfig() {
    const config = await this.prisma.platformConfig.findUnique({
      where: { key: 'pwa_install_enabled' },
    });

    let enabled = true; // 默认启用
    if (config) {
      try {
        enabled = JSON.parse(config.value);
      } catch {
        enabled = true;
      }
    }

    return { enabled };
  }

  /**
   * 获取生态中心页面配置（公开接口）
   * GET /config/ecosystem
   */
  @Public()
  @Get('ecosystem')
  async getEcosystemConfig() {
    const config = await this.prisma.platformConfig.findUnique({
      where: { key: 'ecosystem_page_enabled' },
    });

    let enabled = false; // 默认关闭
    if (config) {
      try {
        enabled = JSON.parse(config.value);
      } catch {
        enabled = false;
      }
    }

    return { enabled };
  }
}
