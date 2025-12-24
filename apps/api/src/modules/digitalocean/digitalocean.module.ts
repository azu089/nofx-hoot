import { Module } from '@nestjs/common';
import { DigitalOceanService } from './digitalocean.service';

/**
 * DigitalOcean 模块
 * 提供 VPS (Droplet) 创建/销毁/查询功能
 */
@Module({
  providers: [DigitalOceanService],
  exports: [DigitalOceanService], // 导出给其他模块使用（如 InstancesModule）
})
export class DigitalOceanModule {}
