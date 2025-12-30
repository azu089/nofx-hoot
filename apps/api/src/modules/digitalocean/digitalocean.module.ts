import { Module } from '@nestjs/common';
import { DigitalOceanService } from './digitalocean.service';
import { NetworkWhitelistService } from '../../common/services/network-whitelist.service';

/**
 * DigitalOcean 模块
 * 提供 VPS (Droplet) 创建/销毁/查询功能
 */
@Module({
  providers: [DigitalOceanService, NetworkWhitelistService],
  exports: [DigitalOceanService, NetworkWhitelistService], // 导出给其他模块使用（如 InstancesModule）
})
export class DigitalOceanModule {}
