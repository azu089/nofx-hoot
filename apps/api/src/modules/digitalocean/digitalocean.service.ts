import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosError } from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import {
  CreateDropletDto,
  DropletResponse,
  DropletListResponse,
} from './dto/droplet.dto';
import { NetworkWhitelistService } from '../../common/services/network-whitelist.service';

/**
 * DigitalOcean API 服务
 * 封装 Droplet 创建/销毁/查询操作
 * 支持沙盒模式（本地开发时模拟，不真正创建 VPS）
 */
@Injectable()
export class DigitalOceanService {
  private readonly logger = new Logger(DigitalOceanService.name);
  private readonly axiosInstance: AxiosInstance;
  private readonly isSandboxMode: boolean;
  private readonly apiToken: string;
  private readonly defaultRegion: string;
  private readonly defaultSize: string;
  private readonly defaultImage: string;
  private readonly vpsPassword: string;
  private readonly sshKeyIds: number[];

  // 沙盒模式下的模拟 Droplet 存储
  private sandboxDroplets: Map<string, DropletResponse> = new Map();

  constructor(
    private readonly configService: ConfigService,
    private readonly networkWhitelistService: NetworkWhitelistService,
  ) {
    // 读取环境变量
    this.apiToken = this.configService.get<string>('DO_API_TOKEN') || '';
    this.isSandboxMode =
      this.configService.get<string>('DO_SANDBOX_MODE') === 'true';
    this.defaultRegion =
      this.configService.get<string>('DO_DEFAULT_REGION') || 'fra1';
    this.defaultSize =
      this.configService.get<string>('DO_DEFAULT_SIZE') || 's-1vcpu-1gb';
    this.defaultImage =
      this.configService.get<string>('DO_DEFAULT_IMAGE') || 'docker-20-04';
    this.vpsPassword =
      this.configService.get<string>('DO_VPS_PASSWORD') || '';
    // SSH Key IDs（从 DigitalOcean 控制台获取，多个用逗号分隔）
    const sshKeyIdsStr = this.configService.get<string>('DO_SSH_KEY_IDS') || '';
    this.sshKeyIds = sshKeyIdsStr
      ? sshKeyIdsStr.split(',').map((id) => parseInt(id.trim(), 10))
      : [];

    // 初始化 Axios 实例
    this.axiosInstance = axios.create({
      baseURL: 'https://api.digitalocean.com/v2',
      timeout: 30000, // 30 秒超时
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiToken}`,
      },
    });

    // 请求重试拦截器
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const config = error.config as any;
        // 如果是超时或 5xx 错误，重试一次
        if (
          config &&
          !config.__retryCount &&
          (error.code === 'ECONNABORTED' ||
            (error.response?.status && error.response.status >= 500))
        ) {
          config.__retryCount = 1;
          this.logger.warn(`请求失败，重试中...`, error.message);
          await this.sleep(2000); // 等待 2 秒
          return this.axiosInstance(config);
        }
        return Promise.reject(error);
      },
    );

    if (this.isSandboxMode) {
      this.logger.warn('⚠️  DigitalOcean 沙盒模式已启用（不会真实创建 VPS）');
    }
  }

  /**
   * 创建 Droplet
   */
  async createDroplet(
    dto: CreateDropletDto,
    instanceId?: string,
  ): Promise<DropletResponse> {
    this.logger.log(`创建 Droplet: ${dto.name}`);

    // 沙盒模式：返回模拟数据
    if (this.isSandboxMode) {
      return this.createSandboxDroplet(dto);
    }

    try {
      // 生成 User Data 脚本
      const userData = instanceId
        ? this.generateUserData(instanceId)
        : this.getUserDataScript();

      // 构造请求体
      const requestBody: Record<string, any> = {
        name: dto.name,
        region: dto.region || this.defaultRegion,
        size: dto.size || this.defaultSize,
        image: dto.image || this.defaultImage,
        tags: dto.tags || ['quantfi', 'auto-created'],
        backups: false, // 不启用自动备份（手动备份到 S3）
        ipv6: false,
        monitoring: true, // 启用监控
        user_data: userData, // 初始化脚本
      };

      // 添加 SSH Keys（如果配置了）
      if (this.sshKeyIds.length > 0) {
        requestBody.ssh_keys = this.sshKeyIds;
        this.logger.log(`使用 SSH Keys: ${this.sshKeyIds.join(', ')}`);
      }

      // 如果没有 SSH Keys，使用统一密码（DO 会发送到邮箱）
      // 注意：DO API 不支持直接设置密码，密码是自动生成的
      // 但我们在 user-data 脚本中可以修改密码

      // 调用 DO API
      const response = await this.axiosInstance.post('/droplets', requestBody);

      const droplet = response.data.droplet;

      // 转换为统一响应格式
      const result: DropletResponse = {
        id: String(droplet.id),
        name: droplet.name,
        status: droplet.status,
        ip: droplet.networks?.v4?.[0]?.ip_address || '',
        region: droplet.region.slug,
        size: droplet.size.slug,
        image: droplet.image.slug,
        createdAt: droplet.created_at,
        tags: droplet.tags || [],
      };

      this.logger.log(`✅ Droplet 创建成功: ${result.id}`);
      return result;
    } catch (error) {
      this.handleApiError(error, '创建 Droplet 失败');
    }
  }

  /**
   * 销毁 Droplet
   */
  async destroyDroplet(dropletId: string): Promise<void> {
    this.logger.log(`销毁 Droplet: ${dropletId}`);

    // 沙盒模式：从内存删除
    if (this.isSandboxMode) {
      if (this.sandboxDroplets.has(dropletId)) {
        this.sandboxDroplets.delete(dropletId);
        this.logger.log(`✅ 沙盒 Droplet 已销毁: ${dropletId}`);
      } else {
        throw new HttpException(
          `Droplet 不存在: ${dropletId}`,
          HttpStatus.NOT_FOUND,
        );
      }
      return;
    }

    try {
      await this.axiosInstance.delete(`/droplets/${dropletId}`);
      this.logger.log(`✅ Droplet 销毁成功: ${dropletId}`);
    } catch (error) {
      this.handleApiError(error, '销毁 Droplet 失败');
    }
  }

  /**
   * 查询 Droplet 状态
   */
  async getDroplet(dropletId: string): Promise<DropletResponse> {
    this.logger.log(`查询 Droplet: ${dropletId}`);

    // 沙盒模式：从内存读取
    if (this.isSandboxMode) {
      const droplet = this.sandboxDroplets.get(dropletId);
      if (!droplet) {
        throw new HttpException(
          `Droplet 不存在: ${dropletId}`,
          HttpStatus.NOT_FOUND,
        );
      }
      return droplet;
    }

    try {
      const response = await this.axiosInstance.get(`/droplets/${dropletId}`);
      const droplet = response.data.droplet;

      return {
        id: String(droplet.id),
        name: droplet.name,
        status: droplet.status,
        ip: droplet.networks?.v4?.[0]?.ip_address || '',
        region: droplet.region.slug,
        size: droplet.size.slug,
        image: droplet.image.slug,
        createdAt: droplet.created_at,
        tags: droplet.tags || [],
      };
    } catch (error) {
      this.handleApiError(error, '查询 Droplet 失败');
    }
  }

  /**
   * 重启 Droplet（硬重启）
   * 通过 DO Droplet Actions API 执行 reboot
   */
  async rebootDroplet(dropletId: string): Promise<void> {
    this.logger.log(`重启 Droplet: ${dropletId}`);

    // 沙盒模式：直接返回成功
    if (this.isSandboxMode) {
      this.logger.log(`[沙盒] 模拟重启 Droplet: ${dropletId}`);
      return;
    }

    try {
      // DigitalOcean Droplet Actions API - reboot
      await this.axiosInstance.post(`/droplets/${dropletId}/actions`, {
        type: 'reboot',
      });
      this.logger.log(`Droplet ${dropletId} 重启指令已发送`);
    } catch (error) {
      this.handleApiError(error, '重启 Droplet 失败');
    }
  }

  /**
   * 列出所有 Droplet
   */
  async listDroplets(tag?: string): Promise<DropletListResponse> {
    this.logger.log(`列出 Droplet, tag=${tag || 'all'}`);

    // 沙盒模式：返回内存数据
    if (this.isSandboxMode) {
      const droplets = Array.from(this.sandboxDroplets.values());
      const filtered = tag
        ? droplets.filter((d) => d.tags.includes(tag))
        : droplets;
      return {
        droplets: filtered,
        total: filtered.length,
      };
    }

    try {
      const params: any = { per_page: 100 };
      if (tag) params.tag_name = tag;

      const response = await this.axiosInstance.get('/droplets', { params });

      const droplets = response.data.droplets.map((droplet: any) => ({
        id: String(droplet.id),
        name: droplet.name,
        status: droplet.status,
        ip: droplet.networks?.v4?.[0]?.ip_address || '',
        region: droplet.region.slug,
        size: droplet.size.slug,
        image: droplet.image.slug,
        createdAt: droplet.created_at,
        tags: droplet.tags || [],
      }));

      return {
        droplets,
        total: response.data.meta?.total || droplets.length,
      };
    } catch (error) {
      this.handleApiError(error, '列出 Droplet 失败');
    }
  }

  /**
   * 获取 Droplet 状态（用于状态同步）
   * @returns {status: 'new'|'active'|'off'|'error', ip: string}
   */
  async getDropletStatus(
    dropletId: string,
  ): Promise<{ status: string; ip: string }> {
    this.logger.debug(`获取 Droplet 状态: ${dropletId}`);

    // 沙盒模式：模拟状态变化
    if (this.isSandboxMode) {
      const droplet = this.sandboxDroplets.get(dropletId);
      if (!droplet) {
        throw new HttpException(
          `Droplet 不存在: ${dropletId}`,
          HttpStatus.NOT_FOUND,
        );
      }

      // 沙盒模式下模拟状态变化：new -> active（模拟 30 秒后激活）
      const createdAt = new Date(droplet.createdAt).getTime();
      const now = Date.now();
      const elapsedSeconds = (now - createdAt) / 1000;

      if (elapsedSeconds < 30 && droplet.status === 'active') {
        // 前 30 秒模拟 new 状态
        return { status: 'new', ip: droplet.ip };
      }

      return { status: droplet.status, ip: droplet.ip };
    }

    try {
      const response = await this.axiosInstance.get(`/droplets/${dropletId}`);
      const droplet = response.data.droplet;

      return {
        status: droplet.status,
        ip: droplet.networks?.v4?.[0]?.ip_address || '',
      };
    } catch (error) {
      this.handleApiError(error, '获取 Droplet 状态失败');
    }
  }

  /**
   * 沙盒模式：创建模拟 Droplet
   */
  private createSandboxDroplet(dto: CreateDropletDto): DropletResponse {
    const dropletId = `sandbox-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const fakeIp = `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;

    const sandboxDroplet: DropletResponse = {
      id: dropletId,
      name: dto.name,
      status: 'active',
      ip: fakeIp,
      region: dto.region || this.defaultRegion,
      size: dto.size || this.defaultSize,
      image: dto.image || this.defaultImage,
      createdAt: new Date().toISOString(),
      tags: dto.tags || ['quantfi', 'sandbox'],
    };

    this.sandboxDroplets.set(dropletId, sandboxDroplet);
    this.logger.log(`✅ 沙盒 Droplet 创建成功: ${dropletId}, IP: ${fakeIp}`);

    return sandboxDroplet;
  }

  /**
   * 获取初始化脚本（User Data）
   * @deprecated 使用 generateUserData() 代替
   */
  private getUserDataScript(): string {
    return `#!/bin/bash
# QuantFi VPS 初始化脚本

# 更新系统
apt-get update -y

# 安装 Docker（如果镜像没有）
if ! command -v docker &> /dev/null; then
  curl -fsSL https://get.docker.com -o get-docker.sh
  sh get-docker.sh
  systemctl start docker
  systemctl enable docker
fi

# 安装 Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# 创建工作目录
mkdir -p /opt/quantfi
cd /opt/quantfi

# 写入心跳脚本（后续任务实现）
cat > /opt/quantfi/heartbeat.sh <<'EOF'
#!/bin/bash
# 心跳脚本，定时上报状态
# TODO: 后续实现
EOF

chmod +x /opt/quantfi/heartbeat.sh

echo "QuantFi VPS 初始化完成"
`;
  }

  /**
   * 生成 User Data 脚本（从模板替换变量）
   * @param instanceId 实例 ID
   * @returns User Data 脚本内容
   */
  generateUserData(instanceId: string): string {
    try {
      // 读取模板文件
      const templatePath = path.join(
        __dirname,
        'templates',
        'user-data.sh',
      );

      if (!fs.existsSync(templatePath)) {
        this.logger.warn(
          `User Data 模板不存在: ${templatePath}，使用默认脚本`,
        );
        return this.getUserDataScript();
      }

      let template = fs.readFileSync(templatePath, 'utf-8');

      // 替换变量
      const apiEndpoint =
        this.configService.get<string>('API_ENDPOINT') ||
        'http://localhost:4000';

      // 生成实例令牌（用于 API 认证）
      const instanceToken =
        this.networkWhitelistService.generateInstanceToken(instanceId);

      // 生成 SSH 白名单 iptables 规则
      const whitelistConfig = this.networkWhitelistService.getConfig();
      const sshWhitelistRules = whitelistConfig.sshAllowedIps
        .map((ip) => `iptables -A INPUT -p tcp --dport 22 -s ${ip} -j ACCEPT`)
        .join('\n');

      // 生成 Freqtrade API Token（用于 Freqtrade API 认证）
      const freqtradeApiToken = this.networkWhitelistService.generateFreqtradeToken(instanceId);

      // 获取主服务器 IP（用于代理端口白名单）
      const masterServerIp = this.configService.get<string>('MASTER_SERVER_IP') || '0.0.0.0/0';

      // 替换所有占位符
      template = template.replace(/\{\{INSTANCE_ID\}\}/g, instanceId);
      template = template.replace(/\{\{API_ENDPOINT\}\}/g, apiEndpoint);
      template = template.replace(/\{\{INSTANCE_TOKEN\}\}/g, instanceToken);
      template = template.replace(/\{\{FREQTRADE_API_TOKEN\}\}/g, freqtradeApiToken);
      template = template.replace(/\{\{SSH_WHITELIST_RULES\}\}/g, sshWhitelistRules);
      template = template.replace(/\{\{MASTER_SERVER_IP\}\}/g, masterServerIp);
      template = template.replace(/\{\{GENERATED_AT\}\}/g, new Date().toISOString());
      template = template.replace(/\{\{VPS_PASSWORD\}\}/g, this.vpsPassword || 'QuantFi@Secure2024');

      // API_KEY_ENCRYPTED 暂时保留占位符（后续任务实现）
      template = template.replace(
        /\{\{API_KEY_ENCRYPTED\}\}/g,
        'placeholder-for-future',
      );

      this.logger.log(
        `生成 User Data 脚本: instanceId=${instanceId}, SSH白名单IP数量=${whitelistConfig.sshAllowedIps.length}`,
      );
      return template;
    } catch (error) {
      this.logger.error(`生成 User Data 失败: ${error.message}`, error.stack);
      // 降级：返回默认脚本
      return this.getUserDataScript();
    }
  }

  /**
   * 错误处理
   */
  private handleApiError(error: any, message: string): never {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR;
      const detail = error.response?.data?.message || error.message;
      this.logger.error(`${message}: ${detail}`, error.stack);
      throw new HttpException(`${message}: ${detail}`, status);
    }

    this.logger.error(message, error.stack);
    throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
  }

  /**
   * 延迟函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
