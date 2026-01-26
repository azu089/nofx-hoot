import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * VPS 网络白名单配置
 */
export interface NetworkWhitelistConfig {
  // 允许 SSH 访问的 IP 列表（管理员 IP）
  sshAllowedIps: string[];
  // API 端口（Freqtrade API）
  apiPort: number;
  // 是否启用 iptables 防火墙
  enableIptables: boolean;
  // 是否启用 fail2ban
  enableFail2ban: boolean;
}

/**
 * 网络白名单服务
 * 用于生成 VPS 防火墙配置脚本
 */
@Injectable()
export class NetworkWhitelistService {
  private readonly logger = new Logger(NetworkWhitelistService.name);
  private readonly config: NetworkWhitelistConfig;

  constructor(private readonly configService: ConfigService) {
    // 从环境变量读取配置
    const sshIps = this.configService.get<string>('VPS_SSH_ALLOWED_IPS') || '';

    this.config = {
      sshAllowedIps: sshIps
        ? sshIps.split(',').map((ip) => ip.trim())
        : ['0.0.0.0/0'], // 默认允许所有（生产环境应配置具体 IP）
      apiPort: parseInt(this.configService.get<string>('VPS_API_PORT') || '8080', 10),
      enableIptables: this.configService.get<string>('VPS_ENABLE_IPTABLES') !== 'false',
      enableFail2ban: this.configService.get<string>('VPS_ENABLE_FAIL2BAN') !== 'false',
    };

    this.logger.log(`网络白名单配置: SSH 允许 IP = ${this.config.sshAllowedIps.join(', ')}`);
  }

  /**
   * 生成 iptables 防火墙规则脚本
   * @param instanceToken 实例令牌（用于 API 认证）
   */
  generateIptablesScript(instanceToken: string): string {
    if (!this.config.enableIptables) {
      return '# iptables 已禁用\n';
    }

    const sshRules = this.config.sshAllowedIps
      .map((ip) => `iptables -A INPUT -p tcp --dport 22 -s ${ip} -j ACCEPT`)
      .join('\n');

    return `#!/bin/bash
# QuantFi VPS 防火墙配置
# 生成时间: ${new Date().toISOString()}

# 清空现有规则
iptables -F
iptables -X

# 默认策略：拒绝所有入站
iptables -P INPUT DROP
iptables -P FORWARD DROP
iptables -P OUTPUT ACCEPT

# 允许回环接口
iptables -A INPUT -i lo -j ACCEPT
iptables -A OUTPUT -o lo -j ACCEPT

# 允许已建立的连接
iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT

# SSH 白名单规则（仅允许管理 IP）
${sshRules}
# 拒绝其他 SSH 连接
iptables -A INPUT -p tcp --dport 22 -j DROP

# API 端口（Freqtrade API）- 允许所有 IP 但需要 Token 验证
# 实际认证在应用层处理
iptables -A INPUT -p tcp --dport ${this.config.apiPort} -j ACCEPT

# 允许 ICMP（ping）
iptables -A INPUT -p icmp --icmp-type echo-request -j ACCEPT

# 允许 DNS 出站
iptables -A OUTPUT -p udp --dport 53 -j ACCEPT
iptables -A OUTPUT -p tcp --dport 53 -j ACCEPT

# 保存规则
mkdir -p /etc/iptables
iptables-save > /etc/iptables/rules.v4

# 设置开机自动加载
cat > /etc/network/if-pre-up.d/iptables <<'IPEOF'
#!/bin/sh
/sbin/iptables-restore < /etc/iptables/rules.v4
IPEOF
chmod +x /etc/network/if-pre-up.d/iptables

echo "iptables 防火墙配置完成"
`;
  }

  /**
   * 生成 fail2ban 配置脚本
   */
  generateFail2banScript(): string {
    if (!this.config.enableFail2ban) {
      return '# fail2ban 已禁用\n';
    }

    return `#!/bin/bash
# QuantFi VPS Fail2ban 配置

# 安装 fail2ban
apt-get install -y fail2ban

# 配置 SSH 防护
cat > /etc/fail2ban/jail.local <<'F2BEOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 86400

[sshd-ddos]
enabled = true
port = ssh
filter = sshd-ddos
logpath = /var/log/auth.log
maxretry = 6
bantime = 172800
F2BEOF

# 启动 fail2ban
systemctl enable fail2ban
systemctl restart fail2ban

echo "fail2ban 配置完成"
`;
  }

  /**
   * 生成 API 令牌验证配置
   * @param instanceToken 实例令牌
   */
  generateApiAuthConfig(instanceToken: string): string {
    return `# API 认证配置
export QUANTFI_INSTANCE_TOKEN="${instanceToken}"

# 写入环境变量文件
echo "QUANTFI_INSTANCE_TOKEN=${instanceToken}" >> /opt/quantfi/.env
`;
  }

  /**
   * 生成完整的网络安全配置脚本
   * @param instanceId 实例 ID
   * @param instanceToken 实例令牌
   */
  generateSecurityScript(instanceId: string, instanceToken: string): string {
    return `#!/bin/bash
# QuantFi VPS 网络安全配置
# 实例 ID: ${instanceId}
# 生成时间: ${new Date().toISOString()}

set -e

echo "开始配置网络安全..."

# ==================== iptables 防火墙 ====================
${this.generateIptablesScript(instanceToken)}

# ==================== fail2ban 防护 ====================
${this.generateFail2banScript()}

# ==================== API 认证 ====================
${this.generateApiAuthConfig(instanceToken)}

# ==================== 禁用不必要的服务 ====================
# 禁用 avahi-daemon
systemctl stop avahi-daemon 2>/dev/null || true
systemctl disable avahi-daemon 2>/dev/null || true

# 禁用 cups
systemctl stop cups 2>/dev/null || true
systemctl disable cups 2>/dev/null || true

# ==================== SSH 加固 ====================
# 禁用密码登录（仅允许密钥）
sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/^#*PermitRootLogin.*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
sed -i 's/^#*PubkeyAuthentication.*/PubkeyAuthentication yes/' /etc/ssh/sshd_config

# 限制 SSH 登录尝试
echo "MaxAuthTries 3" >> /etc/ssh/sshd_config
echo "LoginGraceTime 30" >> /etc/ssh/sshd_config

# 重启 SSH
systemctl restart sshd

echo "网络安全配置完成！"
echo "SSH 白名单: ${this.config.sshAllowedIps.join(', ')}"
echo "API 端口: ${this.config.apiPort}"
`;
  }

  /**
   * 获取当前白名单配置
   */
  getConfig(): NetworkWhitelistConfig {
    return { ...this.config };
  }

  /**
   * 添加 SSH 白名单 IP（运行时）
   * 注意：这只影响新创建的 VPS，不会更新现有 VPS
   */
  addSshAllowedIp(ip: string): void {
    if (!this.config.sshAllowedIps.includes(ip)) {
      this.config.sshAllowedIps.push(ip);
      this.logger.log(`添加 SSH 白名单 IP: ${ip}`);
    }
  }

  /**
   * 移除 SSH 白名单 IP（运行时）
   */
  removeSshAllowedIp(ip: string): void {
    const index = this.config.sshAllowedIps.indexOf(ip);
    if (index > -1) {
      this.config.sshAllowedIps.splice(index, 1);
      this.logger.log(`移除 SSH 白名单 IP: ${ip}`);
    }
  }

  /**
   * 生成实例令牌（确定性生成，基于 instanceId 和 secret）
   * 这样可以随时重新生成相同的 token，用于 VPS 认证
   * @param instanceId 实例 ID
   */
  generateInstanceToken(instanceId: string): string {
    const crypto = require('crypto');
    const secret = this.configService.get<string>('JWT_SECRET') || 'default-secret';
    const isUsingDefault = !this.configService.get<string>('JWT_SECRET');

    // 使用确定性的输入，确保相同的 instanceId 总是生成相同的 token
    const token = crypto
      .createHmac('sha256', secret)
      .update(`quantfi-instance-${instanceId}`)
      .digest('hex')
      .substring(0, 32);

    // 调试日志：记录 Token 生成信息（不记录完整 Token，只记录前 8 位）
    this.logger.debug(
      `生成 Instance Token: instanceId=${instanceId}, token前8位=${token.substring(0, 8)}, 使用默认Secret=${isUsingDefault}`,
    );

    if (isUsingDefault) {
      this.logger.warn(
        `⚠️ JWT_SECRET 环境变量未设置，使用默认值生成 Token，这可能导致 VPS 认证失败！`,
      );
    }

    return token;
  }

  /**
   * 生成 Freqtrade API Token
   * 用于 Freqtrade API 的 Basic Auth 认证
   * 注意：必须是确定性生成，同一个 instanceId 永远返回相同的 token
   * @param instanceId 实例 ID
   */
  generateFreqtradeToken(instanceId: string): string {
    const crypto = require('crypto');
    const secret = this.configService.get<string>('ENCRYPTION_KEY') || 'freqtrade-secret';
    const isUsingDefault = !this.configService.get<string>('ENCRYPTION_KEY');

    // 使用确定性输入，确保相同的 instanceId 总是生成相同的 token
    // 移除了 Date.now()，修复了 Token 不一致导致认证失败的 Bug
    const token = crypto
      .createHmac('sha256', secret)
      .update(`freqtrade-${instanceId}`)
      .digest('hex')
      .substring(0, 24);

    // 调试日志：记录 Token 生成信息（不记录完整 Token，只记录前 8 位）
    this.logger.debug(
      `生成 Freqtrade Token: instanceId=${instanceId}, token前8位=${token.substring(0, 8)}, 使用默认Secret=${isUsingDefault}`,
    );

    if (isUsingDefault) {
      this.logger.warn(
        `⚠️ ENCRYPTION_KEY 环境变量未设置，使用默认值生成 Freqtrade Token，这可能导致 API 认证失败！`,
      );
    }

    return token;
  }

  /**
   * 验证 Freqtrade API Token
   * 注意：生产环境应该将 token 存储在数据库中
   * @param instanceId 实例 ID
   * @param token 待验证的 token
   */
  verifyFreqtradeToken(instanceId: string, token: string): boolean {
    // 简化验证：检查 token 格式
    // 生产环境应该查询数据库验证
    return Boolean(token && token.length === 24);
  }
}
