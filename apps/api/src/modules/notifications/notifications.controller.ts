import { Controller, Get, Post, Param, Query } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('notifications')
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  // 获取通知列表
  @Get()
  async getNotifications(
    @CurrentUser() user: { id: string },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.notificationsService.getNotifications(
      user.id,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  // 获取未读数量
  @Get('unread-count')
  async getUnreadCount(@CurrentUser() user: { id: string }) {
    const count = await this.notificationsService.getUnreadCount(user.id);
    return { count };
  }

  // 标记单条为已读
  @Post(':id/read')
  async markAsRead(
    @CurrentUser() user: { id: string },
    @Param('id') notificationId: string,
  ) {
    await this.notificationsService.markAsRead(user.id, notificationId);
    return { message: '已标记为已读' };
  }

  // 标记所有为已读
  @Post('read-all')
  async markAllAsRead(@CurrentUser() user: { id: string }) {
    await this.notificationsService.markAllAsRead(user.id);
    return { message: '已全部标记为已读' };
  }
}
