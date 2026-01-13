import { Module, Global } from '@nestjs/common';
import { EmailService } from './email.service';

/**
 * 邮件服务模块
 * 使用 Resend 发送邮件
 * 设为全局模块，其他模块可直接注入 EmailService
 */
@Global()
@Module({
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
