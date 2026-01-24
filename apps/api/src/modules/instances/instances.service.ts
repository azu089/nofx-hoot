import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
  InternalServerErrorException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateInstanceDto, HeartbeatDto } from './dto/instance-response.dto';
import { DigitalOceanService } from '../digitalocean/digitalocean.service';
import { FreqtradeService } from '../freqtrade/freqtrade.service';
import { BillingService } from '../billing/billing.service';
import { EventsGateway } from '../../events/events.gateway';
import { InstanceLogService } from './instance-log.service';
import { NetworkWhitelistService } from '../../common/services/network-whitelist.service';
import Decimal from 'decimal.js';

/**
 * VPS 实例服务
 * 处理 VPS 编排、监控、心跳检测等业务逻辑
 *
 * 核心规则（白皮书 2.1）：
 * - 用户购买订阅 → VPS 自动创建
 * - 订阅到期 → VPS 立即销毁（无宽限期）
 * - 用户只能查看 VPS 状态，没有手动创建/销毁权限
 * - VPS 销毁前必须备份到 S3
 * - 心跳超时 15 分钟 → 僵尸节点 → 销毁
 */
@Injectable()
export class InstancesService {
  private readonly logger = new Logger(InstancesService.name);

  // VPS 订阅费（美元/月）- 基准价 $20
  private readonly SUBSCRIPTION_FEE = new Decimal('20');

  constructor(
    private readonly prisma: PrismaService,
    private readonly digitalOceanService: DigitalOceanService,
    private readonly freqtradeService: FreqtradeService,
    private readonly billingService: BillingService,
    private readonly eventsGateway: EventsGateway,
    private readonly instanceLogService: InstanceLogService,
    private readonly networkWhitelistService: NetworkWhitelistService,
  ) {}

  /**
   * 购买订阅（唯一入口）
   * 流程：扣费 → 更新订阅状态 → 自动创建 VPS
   *
   * @param userId 用户 ID
   * @param usePoints 是否使用积分抵扣（默认 true）
   * @param region VPS 区域（默认 sgp1）
   * @returns 订阅结果 + VPS 实例信息
   */
  async purchaseSubscription(
    userId: string,
    region: string = 'sgp1',
  ) {
    // 1. 检查是否已有活跃订阅
    const user = await this.prisma.client.users.findUnique({
      where: { id: userId },
      select: { vip_expires_at: true, vip_level: true },
    });

    const now = new Date();
    const hasActiveSubscription = user?.vip_expires_at && new Date(user.vip_expires_at) > now;

    if (hasActiveSubscription) {
      throw new ConflictException(
        `您已有有效订阅，到期时间: ${user.vip_expires_at}。无需重复购买。`,
      );
    }

    // 2. 检查是否已有活跃 VPS（理论上不可能，但做防护）
    const existingInstance = await this.prisma.client.instances.findFirst({
      where: {
        user_id: userId,
        status: { notIn: ['destroyed', 'error'] },
      },
    });

    if (existingInstance) {
      throw new ConflictException('您已有活跃的 VPS 实例');
    }

    // 3. 扣费（通过 BillingService，仅支持 USDT）
    this.logger.log(`用户 ${userId} 开始购买订阅，费用: ${this.SUBSCRIPTION_FEE} USDT`);

    const billingResult = await this.billingService.chargeSubscription(
      userId,
      this.SUBSCRIPTION_FEE.toString(),
      'VPS 实例订阅 - 月费',
    );

    // 4. 更新订阅状态
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 1);

    await this.prisma.client.users.update({
      where: { id: userId },
      data: {
        vip_level: 1,
        vip_expires_at: expiresAt,
      },
    });

    this.logger.log(`用户 ${userId} 订阅成功，到期时间: ${expiresAt.toISOString()}`);

    // 5. 自动创建 VPS
    const instance = await this.createVpsInternal(userId, region);

    return {
      subscription: {
        vipLevel: 1,
        expiresAt: expiresAt.toISOString(),
        fee: this.SUBSCRIPTION_FEE.toString(),
        pointsUsed: billingResult.pointsUsed,
        usdtUsed: billingResult.usdtUsed,
      },
      instance,
    };
  }

  /**
   * 用户手动创建 VPS（需要有效订阅）
   * 限制：一个订阅账号只能创建 1 个 VPS
   *
   * @param userId 用户 ID
   * @param region VPS 区域（默认 sgp1）
   * @returns VPS 实例信息
   */
  async createVps(userId: string, region: string = 'sgp1') {
    // 1. 检查是否有有效订阅
    const user = await this.prisma.client.users.findUnique({
      where: { id: userId },
      select: { vip_expires_at: true, vip_level: true },
    });

    const now = new Date();
    const hasActiveSubscription = user?.vip_expires_at && new Date(user.vip_expires_at) > now;

    if (!hasActiveSubscription) {
      throw new BadRequestException('您没有有效订阅，请先购买订阅');
    }

    // 2. 检查是否已有活跃 VPS（一个订阅只能创建 1 个 VPS）
    const existingInstance = await this.prisma.client.instances.findFirst({
      where: {
        user_id: userId,
        status: { notIn: ['destroyed', 'error'] },
      },
    });

    if (existingInstance) {
      throw new ConflictException(
        '您已有活跃的 VPS 实例，一个订阅账号只能创建 1 个 VPS',
      );
    }

    this.logger.log(`用户 ${userId} 手动创建 VPS，区域: ${region}`);

    // 3. 创建 VPS
    return this.createVpsInternal(userId, region);
  }

  /**
   * 用户手动销毁 VPS
   *
   * @param id 实例 ID
   * @param userId 用户 ID
   * @returns 销毁结果
   */
  async destroyVps(id: string, userId: string) {
    const instance = await this.findById(id, userId);

    if (instance.status === 'destroyed') {
      throw new ConflictException('实例已销毁');
    }

    if (instance.status === 'destroying') {
      throw new ConflictException('实例正在销毁中，请稍候');
    }

    this.logger.log(`用户 ${userId} 手动销毁 VPS: ${id}`);

    // 执行销毁
    return this.destroy(id, userId, '用户手动销毁');
  }

  /**
   * 内部方法：创建 VPS 实例
   * 仅供 purchaseSubscription、createVps 和系统内部调用
   */
  private async createVpsInternal(userId: string, region: string = 'sgp1') {
    // 🔒 开发模式保护：禁止创建 VPS
    const isDevelopmentMode = process.env.DEVELOPMENT_MODE === 'true';
    if (isDevelopmentMode) {
      this.logger.warn(
        `⚠️  开发模式已启用，VPS 创建被阻止（用户: ${userId}）`,
      );
      throw new BadRequestException(
        '开发模式下禁止创建 VPS。请在生产环境或将 DEVELOPMENT_MODE 设为 false 后重试。',
      );
    }

    // 创建实例记录（状态为 pending）
    const instance = await this.prisma.client.instances.create({
      data: {
        user_id: userId,
        region: region,
        size: 's-1vcpu-1gb',
        status: 'pending',
      },
    });

    this.logger.log(`创建实例记录: ${instance.id}, 用户: ${userId}`);

    try {
      // 5. 调用 DO API 创建 Droplet
      const droplet = await this.digitalOceanService.createDroplet(
        {
          name: `quantfi-${userId.substring(0, 8)}-${instance.id.substring(0, 8)}`,
          region: instance.region,
          size: instance.size,
          tags: ['quantfi', `user-${userId}`, `instance-${instance.id}`],
        },
        instance.id, // 传递 instanceId 用于生成 User Data
      );

      this.logger.log(
        `Droplet 创建成功: ${droplet.id}, IP: ${droplet.ip}, 实例: ${instance.id}`,
      );

      // 6. 更新实例记录
      // 注意：新创建的 Droplet 可能还没有 IP，需要等待状态同步
      const updatedInstance = await this.prisma.client.instances.update({
        where: { id: instance.id },
        data: {
          droplet_id: droplet.id,
          ip_address: droplet.ip || null, // IP 为空时使用 null
          status: droplet.status === 'active' ? 'provisioning' : 'pending',
          provisioned_at: new Date(),
        },
      });

      this.logger.log(
        `实例创建完成: ${instance.id}, 状态: ${updatedInstance.status}`,
      );

      // 推送实例创建成功日志（WebSocket）
      this.pushLog(
        instance.id,
        `VPS 实例创建成功，IP: ${droplet.ip}`,
        'info',
        { dropletId: droplet.id },
      );

      // 推送状态变更通知
      this.pushStatusChange(
        userId,
        instance.id,
        updatedInstance.status,
        '实例创建成功',
      );

      // 记录系统日志到数据库
      await this.instanceLogService.info(
        userId,
        'instance_create',
        `VPS 实例创建成功 (IP: ${droplet.ip})`,
        {
          instanceId: instance.id,
          details: {
            dropletId: droplet.id,
            ip: droplet.ip,
            region: region,
          },
        },
      );

      return updatedInstance;
    } catch (error) {
      // 7. 创建失败，标记为 error
      this.logger.error(
        `创建 Droplet 失败: ${error.message}`,
        error.stack,
      );

      // 截断错误消息，避免超过数据库字段长度限制 (100字符)
      const errorMsg = `创建失败: ${error.message}`.substring(0, 95);
      await this.prisma.client.instances.update({
        where: { id: instance.id },
        data: {
          status: 'error',
          destroy_reason: errorMsg,
        },
      });

      throw new InternalServerErrorException(
        `创建 VPS 失败: ${error.message}`,
      );
    }
  }

  /**
   * 获取用户的所有实例
   */
  async findAllByUserId(userId: string) {
    return this.prisma.client.instances.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
    });
  }

  /**
   * 获取实例详情
   */
  async findById(id: string, userId: string) {
    const instance = await this.prisma.client.instances.findFirst({
      where: { id, user_id: userId },
    });

    if (!instance) {
      throw new NotFoundException('实例不存在');
    }

    return instance;
  }

  /**
   * 销毁实例（调用 DO API）
   */
  async destroy(id: string, userId: string, reason: string) {
    const instance = await this.findById(id, userId);

    if (instance.status === 'destroyed') {
      throw new ConflictException('实例已销毁');
    }

    // TODO: 备份到 S3（后续任务实现）

    try {
      // 1. 调用 DO API 销毁 Droplet
      if (instance.droplet_id) {
        this.logger.log(`销毁 Droplet: ${instance.droplet_id}`);
        await this.digitalOceanService.destroyDroplet(instance.droplet_id);
      } else {
        this.logger.warn(`实例 ${id} 没有 droplet_id，跳过 DO API 调用`);
      }

      // 2. 更新数据库记录
      const updatedInstance = await this.prisma.client.instances.update({
        where: { id },
        data: {
          status: 'destroyed',
          destroyed_at: new Date(),
          destroy_reason: reason,
        },
      });

      this.logger.log(`销毁实例成功: ${id}, 原因: ${reason}`);

      // 推送实例销毁日志（WebSocket）
      this.pushLog(id, `VPS 实例已销毁，原因: ${reason}`, 'warn');

      // 推送状态变更通知
      this.pushStatusChange(userId, id, 'destroyed', reason);

      // 记录系统日志到数据库
      await this.instanceLogService.info(
        userId,
        'instance_destroy',
        `VPS 实例已销毁`,
        {
          instanceId: id,
          details: { reason },
        },
      );

      return updatedInstance;
    } catch (error) {
      // 销毁失败，记录错误但仍更新状态
      this.logger.error(
        `销毁 Droplet 失败: ${error.message}，继续标记为销毁`,
        error.stack,
      );

      const updatedInstance = await this.prisma.client.instances.update({
        where: { id },
        data: {
          status: 'destroyed',
          destroyed_at: new Date(),
          destroy_reason: `${reason} (DO API 失败: ${error.message})`,
        },
      });

      return updatedInstance;
    }
  }

  /**
   * 硬重启 VPS（用于僵尸节点恢复）
   * 通过 DigitalOcean API 强制重启 Droplet
   */
  async rebootInstance(id: string, userId: string) {
    const instance = await this.prisma.client.instances.findFirst({
      where: { id, user_id: userId },
    });

    if (!instance) {
      throw new NotFoundException('实例不存在');
    }

    if (!instance.droplet_id) {
      throw new ConflictException('实例无有效 Droplet ID');
    }

    // 只允许 zombie 或 running 状态的实例重启
    if (!['zombie', 'running'].includes(instance.status)) {
      throw new ConflictException(`实例状态为 ${instance.status}，无法重启`);
    }

    this.logger.log(`[VPS重启] 用户 ${userId} 请求重启实例 ${id}`);

    try {
      // 调用 DigitalOcean API 重启 Droplet
      await this.digitalOceanService.rebootDroplet(instance.droplet_id);

      // 推送日志
      this.pushLog(id, '用户触发 VPS 重启，请等待 2-3 分钟', 'info');

      return { success: true, message: 'VPS 重启指令已发送' };
    } catch (error) {
      this.logger.error(`[VPS重启] 实例 ${id} 重启失败: ${error.message}`);
      this.pushLog(id, `VPS 重启失败: ${error.message}`, 'error');
      throw new ConflictException(`VPS 重启失败: ${error.message}`);
    }
  }

  /**
   * 接收心跳上报
   *
   * 重要：如果实例是 zombie 状态，收到心跳后自动恢复为 running
   */
  async heartbeat(id: string, dto: HeartbeatDto) {
    const instance = await this.prisma.client.instances.findUnique({
      where: { id },
    });

    if (!instance) {
      throw new NotFoundException('实例不存在');
    }

    if (instance.status === 'destroyed') {
      throw new ConflictException('实例已销毁');
    }

    // 如果从 zombie 状态恢复，记录日志并推送通知
    const wasZombie = instance.status === 'zombie';
    if (wasZombie) {
      this.logger.log(`实例 ${id} 从僵尸状态恢复，收到心跳`);
      this.pushLog(id, '实例已恢复正常，心跳已恢复', 'info');
      this.pushStatusChange(instance.user_id, id, 'running', '心跳已恢复');
    }

    await this.prisma.client.instances.update({
      where: { id },
      data: {
        last_heartbeat: new Date(),
        cpu_usage: dto.cpuUsage,
        memory_usage: dto.memoryUsage,
        disk_usage: dto.diskUsage,
        status: 'running',
        // 如果恢复了，清除销毁原因
        destroy_reason: wasZombie ? null : instance.destroy_reason,
      },
    });

    this.logger.debug(`心跳: ${id}${wasZombie ? ' (从僵尸状态恢复)' : ''}`);

    return { received: true, timestamp: new Date() };
  }

  /**
   * VPS 初始化完成回调
   * VPS 初始化脚本在所有服务就绪后调用此接口
   * 用于立即更新实例状态为 running，无需等待心跳同步
   *
   * @param id 实例 ID
   * @param token 实例令牌（用于验证请求来自 VPS）
   * @param dto 就绪状态详情
   */
  async markAsReady(
    id: string,
    token: string,
    dto: {
      status: string;
      freqtradeStatus?: string;
      proxyStatus?: string;
    },
  ) {
    // 1. 验证 Token
    const expectedToken = this.networkWhitelistService.generateInstanceToken(id);
    if (!token || token !== expectedToken) {
      this.logger.warn(`[VPS就绪] 实例 ${id} Token 验证失败`);
      throw new UnauthorizedException('无效的实例 Token');
    }

    // 2. 查找实例
    const instance = await this.prisma.client.instances.findUnique({
      where: { id },
    });

    if (!instance) {
      throw new NotFoundException('实例不存在');
    }

    this.logger.log(
      `[VPS就绪] 收到实例 ${id} 就绪通知，Freqtrade: ${dto.freqtradeStatus}, Proxy: ${dto.proxyStatus}`,
    );

    // 3. 如果实例还是 provisioning/pending 状态，立即标记为 running
    const previousStatus = instance.status;
    if (['provisioning', 'pending'].includes(previousStatus)) {
      await this.prisma.client.instances.update({
        where: { id },
        data: {
          status: 'running',
          last_heartbeat: new Date(),
        },
      });

      this.logger.log(
        `[VPS就绪] 实例 ${id} 状态从 ${previousStatus} 更新为 running`,
      );

      // 4. 记录就绪日志到数据库
      await this.instanceLogService.info(
        instance.user_id,
        'instance_ready',
        'VPS 初始化完成，交易机器人和代理服务已就绪',
        {
          instanceId: id,
          details: {
            freqtradeStatus: dto.freqtradeStatus || 'unknown',
            proxyStatus: dto.proxyStatus || 'unknown',
          },
        },
      );

      // 5. 推送 WebSocket 通知
      this.pushStatusChange(instance.user_id, id, 'running', 'VPS 就绪');

      // 6. 推送日志
      this.pushLog(
        id,
        `VPS 初始化完成，服务已就绪`,
        'info',
        {
          freqtradeStatus: dto.freqtradeStatus,
          proxyStatus: dto.proxyStatus,
        },
      );
    } else {
      this.logger.debug(
        `[VPS就绪] 实例 ${id} 当前状态为 ${previousStatus}，跳过状态更新`,
      );
    }

    return {
      success: true,
      message: 'VPS 就绪',
      previousStatus,
      currentStatus: 'running',
    };
  }

  /**
   * 检测僵尸节点（15 分钟无心跳）
   */
  async findZombieInstances() {
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

    return this.prisma.client.instances.findMany({
      where: {
        status: 'running',
        last_heartbeat: {
          lt: fifteenMinutesAgo,
        },
      },
    });
  }

  /**
   * 标记实例为僵尸节点
   * @param instanceId 实例 ID
   */
  async markAsZombie(instanceId: string) {
    const instance = await this.prisma.client.instances.findUnique({
      where: { id: instanceId },
    });

    if (!instance) {
      this.logger.warn(`标记僵尸节点失败: 实例不存在 ${instanceId}`);
      return null;
    }

    if (instance.status !== 'running') {
      this.logger.debug(
        `跳过标记僵尸节点: 实例状态非 running ${instanceId}, 当前状态: ${instance.status}`,
      );
      return null;
    }

    const updatedInstance = await this.prisma.client.instances.update({
      where: { id: instanceId },
      data: {
        status: 'zombie',
        destroy_reason: '心跳超时（15分钟无响应）',
      },
    });

    this.logger.error(
      `[僵尸节点告警] 实例 ${instanceId} 标记为僵尸节点，用户 ${instance.user_id}，最后心跳: ${instance.last_heartbeat}`,
    );

    // 推送僵尸节点告警（WebSocket）
    this.pushLog(
      instanceId,
      `实例心跳超时（15分钟无响应），已标记为僵尸节点`,
      'error',
      { lastHeartbeat: instance.last_heartbeat },
    );

    // 推送状态变更通知
    this.pushStatusChange(
      instance.user_id,
      instanceId,
      'zombie',
      '心跳超时（15分钟无响应）',
    );

    // 记录心跳超时日志到数据库
    await this.instanceLogService.warn(
      instance.user_id,
      'heartbeat',
      '⚠️ 心跳检测失败，VPS 无响应',
      {
        instanceId,
        details: {
          lastHeartbeat: instance.last_heartbeat,
          status: 'zombie',
        },
      },
    );

    return updatedInstance;
  }

  /**
   * 启动策略（启动 VPS 上的交易策略）
   */
  async startStrategy(id: string, userId: string) {
    const instance = await this.findById(id, userId);

    if (instance.status === 'destroyed') {
      throw new ConflictException('实例已销毁，无法启动策略');
    }

    if (instance.status === 'error') {
      throw new ConflictException('实例状态异常，无法启动策略');
    }

    if (instance.status !== 'running' && instance.status !== 'stopped') {
      throw new ConflictException(
        `实例状态为 ${instance.status}，只有 running 或 stopped 状态可以启动策略`,
      );
    }

    // TODO: 后续实现实际的策略启动逻辑（调用 VPS API 或 SSH 执行命令）
    this.logger.log(`启动实例 ${id} 的交易策略`);

    // 更新状态为 running
    const updatedInstance = await this.prisma.client.instances.update({
      where: { id },
      data: {
        status: 'running',
      },
    });

    this.logger.log(`实例 ${id} 策略已启动`);

    return updatedInstance;
  }

  /**
   * 停止策略（停止 VPS 上的交易策略，但不销毁 VPS）
   */
  async stopStrategy(id: string, userId: string) {
    const instance = await this.findById(id, userId);

    if (instance.status === 'destroyed') {
      throw new ConflictException('实例已销毁');
    }

    if (instance.status !== 'running') {
      throw new ConflictException(
        `实例状态为 ${instance.status}，只有 running 状态可以停止策略`,
      );
    }

    // TODO: 后续实现实际的策略停止逻辑（调用 VPS API 或 SSH 执行命令）
    this.logger.log(`停止实例 ${id} 的交易策略`);

    // 更新状态为 stopped
    const updatedInstance = await this.prisma.client.instances.update({
      where: { id },
      data: {
        status: 'stopped',
      },
    });

    this.logger.log(`实例 ${id} 策略已停止`);

    return updatedInstance;
  }

  /**
   * 重启实例（重启 VPS）
   */
  async restart(id: string, userId: string) {
    const instance = await this.findById(id, userId);

    if (instance.status === 'destroyed') {
      throw new ConflictException('实例已销毁，无法重启');
    }

    if (instance.status === 'error') {
      throw new ConflictException('实例状态异常，无法重启');
    }

    if (!instance.droplet_id) {
      throw new ConflictException('实例缺少 droplet_id，无法重启');
    }

    // TODO: 调用 DO API 重启 Droplet（需要在 DigitalOceanService 添加 rebootDroplet 方法）
    this.logger.log(`重启实例 ${id} (Droplet: ${instance.droplet_id})`);

    // 暂时只更新状态为 provisioning，等待状态同步
    const updatedInstance = await this.prisma.client.instances.update({
      where: { id },
      data: {
        status: 'provisioning',
      },
    });

    this.logger.log(`实例 ${id} 已发送重启指令`);

    return updatedInstance;
  }

  /**
   * 手动同步实例状态（从 DO API）
   */
  async syncStatus(id: string, userId: string) {
    const instance = await this.findById(id, userId);

    if (!instance.droplet_id) {
      throw new ConflictException('实例缺少 droplet_id，无法同步状态');
    }

    if (instance.status === 'destroyed') {
      this.logger.warn(`实例 ${id} 已销毁，跳过状态同步`);
      return instance;
    }

    try {
      // 调用 DO API 获取真实状态
      const dropletStatus = await this.digitalOceanService.getDropletStatus(
        instance.droplet_id,
      );

      this.logger.log(
        `同步实例 ${id} 状态: ${dropletStatus.status}, IP: ${dropletStatus.ip}`,
      );

      // 更新数据库
      const updateData: any = {};

      if (dropletStatus.ip && dropletStatus.ip !== instance.ip_address) {
        updateData.ip_address = dropletStatus.ip;
      }

      if (dropletStatus.status === 'active') {
        updateData.status = 'running';
      } else if (dropletStatus.status === 'off') {
        updateData.status = 'stopped';
      } else if (dropletStatus.status === 'error') {
        updateData.status = 'error';
        updateData.destroy_reason = 'DO Droplet 状态异常';
      }

      if (Object.keys(updateData).length > 0) {
        return await this.prisma.client.instances.update({
          where: { id },
          data: updateData,
        });
      }

      return instance;
    } catch (error) {
      this.logger.error(`同步实例 ${id} 状态失败: ${error.message}`);
      throw new InternalServerErrorException(
        `同步状态失败: ${error.message}`,
      );
    }
  }

  /**
   * 处理创建超时的实例（由定时任务调用）
   */
  async handleProvisioningTimeout() {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

    const timeoutInstances = await this.prisma.client.instances.findMany({
      where: {
        status: 'provisioning',
        provisioned_at: {
          lt: tenMinutesAgo,
        },
      },
    });

    this.logger.log(
      `检测到 ${timeoutInstances.length} 个创建超时的实例`,
    );

    for (const instance of timeoutInstances) {
      await this.prisma.client.instances.update({
        where: { id: instance.id },
        data: {
          status: 'error',
          destroy_reason: '创建超时（超过 10 分钟）',
        },
      });

      this.logger.error(`实例 ${instance.id} 创建超时，已标记为 error`);
    }

    return timeoutInstances;
  }

  /**
   * 获取 Freqtrade 状态
   */
  async getFreqtradeStatus(id: string, userId: string) {
    const instance = await this.findById(id, userId);

    if (!instance.ip_address) {
      throw new ConflictException('实例没有 IP 地址');
    }

    if (instance.status === 'destroyed') {
      throw new ConflictException('实例已销毁');
    }

    const apiToken = this.networkWhitelistService.generateFreqtradeToken(instance.id);
    return this.freqtradeService.getStatus(instance.ip_address, apiToken);
  }

  /**
   * 获取 Freqtrade 余额
   */
  async getFreqtradeBalance(id: string, userId: string) {
    const instance = await this.findById(id, userId);

    if (!instance.ip_address) {
      throw new ConflictException('实例没有 IP 地址');
    }

    if (instance.status === 'destroyed') {
      throw new ConflictException('实例已销毁');
    }

    const apiToken = this.networkWhitelistService.generateFreqtradeToken(instance.id);
    return this.freqtradeService.getBalance(instance.ip_address, apiToken);
  }

  /**
   * 获取 Freqtrade 交易
   */
  async getFreqtradeTrades(id: string, userId: string) {
    const instance = await this.findById(id, userId);

    if (!instance.ip_address) {
      throw new ConflictException('实例没有 IP 地址');
    }

    if (instance.status === 'destroyed') {
      throw new ConflictException('实例已销毁');
    }

    const apiToken = this.networkWhitelistService.generateFreqtradeToken(instance.id);
    return this.freqtradeService.getTrades(instance.ip_address, apiToken);
  }

  /**
   * 强制平仓
   * @param tradeId 交易 ID（可选，不传则全部平仓）
   */
  async forceExit(id: string, userId: string, tradeId?: string) {
    const instance = await this.findById(id, userId);

    if (!instance.ip_address) {
      throw new ConflictException('实例没有 IP 地址');
    }

    if (instance.status === 'destroyed') {
      throw new ConflictException('实例已销毁');
    }

    if (instance.status !== 'running') {
      throw new ConflictException(
        `实例状态为 ${instance.status}，只有 running 状态可以平仓`,
      );
    }

    this.logger.warn(
      `[紧急平仓] 实例 ${id}, 用户 ${userId}, 交易 ID: ${tradeId || '全部'}`,
    );

    // 执行平仓
    const apiToken = this.networkWhitelistService.generateFreqtradeToken(instance.id);
    if (tradeId) {
      // 单个交易平仓
      return this.freqtradeService.forceExit(instance.ip_address, tradeId, apiToken);
    } else {
      // 全部平仓
      return this.freqtradeService.forceExitAll(instance.ip_address, apiToken);
    }
  }

  /**
   * 一键清仓（Panic Sell）
   * 清空用户所有运行中实例的所有持仓
   *
   * 应用场景：黑天鹅事件、极端行情，用户需要立即清空所有持仓
   *
   * @param userId 用户 ID
   * @returns 清仓结果摘要
   */
  async panicSell(userId: string) {
    this.logger.warn(`[PANIC SELL] 用户 ${userId} 触发一键清仓`);

    // 1. 获取用户所有运行中的实例
    const runningInstances = await this.prisma.client.instances.findMany({
      where: {
        user_id: userId,
        status: 'running',
      },
    });

    if (runningInstances.length === 0) {
      return {
        success: true,
        message: '没有运行中的实例',
        instancesProcessed: 0,
        results: [],
      };
    }

    this.logger.warn(
      `[PANIC SELL] 用户 ${userId} 有 ${runningInstances.length} 个运行中的实例`,
    );

    // 2. 对每个实例执行全部平仓
    const results = [];

    for (const instance of runningInstances) {
      try {
        if (!instance.ip_address) {
          results.push({
            instanceId: instance.id,
            success: false,
            error: '实例没有 IP 地址',
          });
          continue;
        }

        // 执行全部平仓
        const apiToken = this.networkWhitelistService.generateFreqtradeToken(instance.id);
        const exitResult = await this.freqtradeService.forceExitAll(
          instance.ip_address,
          apiToken,
        );

        // 推送日志
        this.pushLog(
          instance.id,
          `[PANIC SELL] 一键清仓已执行`,
          'warn',
          { triggeredBy: userId },
        );

        results.push({
          instanceId: instance.id,
          success: true,
          trades: exitResult,
        });

        this.logger.warn(
          `[PANIC SELL] 实例 ${instance.id} 清仓完成`,
        );
      } catch (error) {
        this.logger.error(
          `[PANIC SELL] 实例 ${instance.id} 清仓失败: ${error.message}`,
        );

        results.push({
          instanceId: instance.id,
          success: false,
          error: error.message,
        });
      }
    }

    // 3. 统计结果
    const successCount = results.filter((r) => r.success).length;
    const failedCount = results.filter((r) => !r.success).length;

    this.logger.warn(
      `[PANIC SELL] 用户 ${userId} 一键清仓完成，成功: ${successCount}，失败: ${failedCount}`,
    );

    return {
      success: true,
      message: `一键清仓完成，处理了 ${runningInstances.length} 个实例`,
      instancesProcessed: runningInstances.length,
      successCount,
      failedCount,
      results,
    };
  }

  /**
   * 停止所有运行中的实例
   * @param userId 用户 ID
   * @returns 停止结果摘要
   */
  async stopAll(userId: string) {
    this.logger.warn(`[STOP ALL] 用户 ${userId} 触发停止所有实例`);

    // 1. 获取用户所有运行中的实例
    const runningInstances = await this.prisma.client.instances.findMany({
      where: {
        user_id: userId,
        status: 'running',
      },
    });

    if (runningInstances.length === 0) {
      return {
        success: true,
        stoppedCount: 0,
        failedCount: 0,
        results: [],
      };
    }

    this.logger.warn(
      `[STOP ALL] 用户 ${userId} 有 ${runningInstances.length} 个运行中的实例`,
    );

    // 2. 对每个实例执行停止
    const results = [];

    for (const instance of runningInstances) {
      try {
        await this.stopStrategy(instance.id, userId);

        this.pushLog(
          instance.id,
          `[STOP ALL] 实例已被用户批量停止`,
          'warn',
          { triggeredBy: userId },
        );

        results.push({
          instanceId: instance.id,
          success: true,
        });

        this.logger.warn(`[STOP ALL] 实例 ${instance.id} 已停止`);
      } catch (error) {
        this.logger.error(
          `[STOP ALL] 实例 ${instance.id} 停止失败: ${error.message}`,
        );

        results.push({
          instanceId: instance.id,
          success: false,
          error: error.message,
        });
      }
    }

    // 3. 统计结果
    const stoppedCount = results.filter((r) => r.success).length;
    const failedCount = results.filter((r) => !r.success).length;

    this.logger.warn(
      `[STOP ALL] 用户 ${userId} 停止所有实例完成，成功: ${stoppedCount}，失败: ${failedCount}`,
    );

    return {
      success: true,
      stoppedCount,
      failedCount,
      results,
    };
  }

  // ==================== WebSocket 推送方法 ====================

  /**
   * 推送日志到前端（实时日志流）
   * @param instanceId 实例 ID
   * @param message 日志消息
   * @param level 日志级别
   * @param meta 额外元数据
   */
  pushLog(
    instanceId: string,
    message: string,
    level: 'info' | 'warn' | 'error' | 'debug' = 'info',
    meta?: Record<string, any>,
  ) {
    this.eventsGateway.pushLog(instanceId, {
      message,
      level,
      meta,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 推送状态变更到前端
   * @param userId 用户 ID
   * @param instanceId 实例 ID
   * @param status 新状态
   * @param reason 变更原因
   */
  pushStatusChange(
    userId: string,
    instanceId: string,
    status: string,
    reason?: string,
  ) {
    this.eventsGateway.pushStatus(userId, {
      type: 'instance_status_change',
      instanceId,
      status,
      reason,
      timestamp: new Date().toISOString(),
    });
  }
}
