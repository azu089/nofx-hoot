import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * 诊断结果接口
 */
export interface DiagnosisResult {
  sshReachable: boolean;
  proxyStatus: 'online' | 'stopped' | 'errored' | 'unknown';
  freqtradeStatus: 'running' | 'exited' | 'restarting' | 'unknown';
  port8081Open: boolean;
  port8080Open: boolean;
  diskUsagePercent: number;
  memoryAvailableMB: number;
  repairActions: RepairAction[];
  rawOutput?: Record<string, string>;
}

/**
 * 修复动作类型
 */
export type RepairAction =
  | { type: 'restart_proxy' }
  | { type: 'restart_freqtrade' }
  | { type: 'kill_port_8081' }
  | { type: 'clear_logs' }
  | { type: 'reboot_vps' }
  | { type: 'none'; reason: string };

/**
 * VPS 实例诊断服务
 * 通过 SSH 连接到 VPS 检测各项服务状态
 */
@Injectable()
export class InstanceDiagnosisService {
  private readonly logger = new Logger(InstanceDiagnosisService.name);

  // SSH 连接超时（毫秒）
  private readonly SSH_TIMEOUT = 10000;

  /**
   * 执行完整诊断
   * @param ipAddress VPS IP 地址
   * @returns 诊断结果
   */
  async diagnose(ipAddress: string): Promise<DiagnosisResult> {
    const result: DiagnosisResult = {
      sshReachable: false,
      proxyStatus: 'unknown',
      freqtradeStatus: 'unknown',
      port8081Open: false,
      port8080Open: false,
      diskUsagePercent: 0,
      memoryAvailableMB: 0,
      repairActions: [],
      rawOutput: {},
    };

    this.logger.log(`[诊断] 开始诊断 VPS: ${ipAddress}`);

    // 1. 测试 SSH 连通性
    result.sshReachable = await this.testSSHConnection(ipAddress);
    if (!result.sshReachable) {
      this.logger.warn(`[诊断] SSH 不可达: ${ipAddress}`);
      result.repairActions.push({ type: 'none', reason: 'SSH 不可达，无法远程诊断' });
      return result;
    }

    // 2. 检查各项服务（并行执行提高效率）
    const [proxyCheck, freqtradeCheck, diskCheck, memoryCheck] = await Promise.all([
      this.checkProxyStatus(ipAddress),
      this.checkFreqtradeStatus(ipAddress),
      this.checkDiskUsage(ipAddress),
      this.checkMemory(ipAddress),
    ]);

    result.proxyStatus = proxyCheck.status;
    result.port8081Open = proxyCheck.portOpen;
    if (result.rawOutput) result.rawOutput['proxy'] = proxyCheck.raw;

    result.freqtradeStatus = freqtradeCheck.status;
    result.port8080Open = freqtradeCheck.portOpen;
    if (result.rawOutput) result.rawOutput['freqtrade'] = freqtradeCheck.raw;

    result.diskUsagePercent = diskCheck.usagePercent;
    if (result.rawOutput) result.rawOutput['disk'] = diskCheck.raw;

    result.memoryAvailableMB = memoryCheck.availableMB;
    if (result.rawOutput) result.rawOutput['memory'] = memoryCheck.raw;

    // 3. 生成修复方案
    result.repairActions = this.generateRepairPlan(result);

    this.logger.log(
      `[诊断] 诊断完成: ${ipAddress}, SSH=${result.sshReachable}, ` +
        `Proxy=${result.proxyStatus}, Freqtrade=${result.freqtradeStatus}, ` +
        `Disk=${result.diskUsagePercent}%, Memory=${result.memoryAvailableMB}MB, ` +
        `Actions=${result.repairActions.length}`,
    );

    return result;
  }

  /**
   * 测试 SSH 连通性
   */
  private async testSSHConnection(ipAddress: string): Promise<boolean> {
    try {
      const cmd = `ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no -o BatchMode=yes root@${ipAddress} "echo ok" 2>/dev/null`;
      const { stdout } = await execAsync(cmd, { timeout: this.SSH_TIMEOUT });
      return stdout.trim() === 'ok';
    } catch (error) {
      this.logger.debug(`[诊断] SSH 连接失败: ${ipAddress}, ${error.message}`);
      return false;
    }
  }

  /**
   * 检查代理服务状态
   */
  private async checkProxyStatus(
    ipAddress: string,
  ): Promise<{ status: 'online' | 'stopped' | 'errored' | 'unknown'; portOpen: boolean; raw: string }> {
    try {
      // 检查 PM2 进程状态
      const cmd = `ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no root@${ipAddress} "pm2 jlist 2>/dev/null || echo '[]'"`;
      const { stdout } = await execAsync(cmd, { timeout: this.SSH_TIMEOUT });

      let status: 'online' | 'stopped' | 'errored' | 'unknown' = 'unknown';
      let portOpen = false;

      try {
        const processes = JSON.parse(stdout.trim());
        const proxy = processes.find((p: any) => p.name === 'quantfi-proxy');

        if (proxy) {
          if (proxy.pm2_env?.status === 'online') {
            status = 'online';
          } else if (proxy.pm2_env?.status === 'stopped') {
            status = 'stopped';
          } else if (proxy.pm2_env?.status === 'errored') {
            status = 'errored';
          }
        } else {
          status = 'stopped';
        }
      } catch {
        status = 'unknown';
      }

      // 检查端口
      const portCmd = `ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no root@${ipAddress} "netstat -tlnp 2>/dev/null | grep ':8081' || echo 'not found'"`;
      const { stdout: portStdout } = await execAsync(portCmd, { timeout: this.SSH_TIMEOUT });
      portOpen = !portStdout.includes('not found');

      return { status, portOpen, raw: stdout.trim() };
    } catch (error) {
      this.logger.debug(`[诊断] 检查代理服务失败: ${error.message}`);
      return { status: 'unknown', portOpen: false, raw: error.message };
    }
  }

  /**
   * 检查 Freqtrade 容器状态
   */
  private async checkFreqtradeStatus(
    ipAddress: string,
  ): Promise<{ status: 'running' | 'exited' | 'restarting' | 'unknown'; portOpen: boolean; raw: string }> {
    try {
      const cmd = `ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no root@${ipAddress} "docker ps -a --filter name=freqtrade --format '{{.Status}}' 2>/dev/null || echo 'not found'"`;
      const { stdout } = await execAsync(cmd, { timeout: this.SSH_TIMEOUT });

      let status: 'running' | 'exited' | 'restarting' | 'unknown' = 'unknown';
      let portOpen = false;

      const statusStr = stdout.trim().toLowerCase();
      if (statusStr.includes('up') && statusStr.includes('healthy')) {
        status = 'running';
      } else if (statusStr.includes('up')) {
        status = 'running';
      } else if (statusStr.includes('exited')) {
        status = 'exited';
      } else if (statusStr.includes('restarting')) {
        status = 'restarting';
      }

      // 检查端口
      const portCmd = `ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no root@${ipAddress} "netstat -tlnp 2>/dev/null | grep ':8080' || echo 'not found'"`;
      const { stdout: portStdout } = await execAsync(portCmd, { timeout: this.SSH_TIMEOUT });
      portOpen = !portStdout.includes('not found');

      return { status, portOpen, raw: stdout.trim() };
    } catch (error) {
      this.logger.debug(`[诊断] 检查 Freqtrade 失败: ${error.message}`);
      return { status: 'unknown', portOpen: false, raw: error.message };
    }
  }

  /**
   * 检查磁盘使用率
   */
  private async checkDiskUsage(ipAddress: string): Promise<{ usagePercent: number; raw: string }> {
    try {
      const cmd = `ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no root@${ipAddress} "df -h / | tail -1 | awk '{print \\$5}' | tr -d '%'"`;
      const { stdout } = await execAsync(cmd, { timeout: this.SSH_TIMEOUT });

      const usagePercent = parseInt(stdout.trim(), 10) || 0;
      return { usagePercent, raw: stdout.trim() };
    } catch (error) {
      this.logger.debug(`[诊断] 检查磁盘失败: ${error.message}`);
      return { usagePercent: 0, raw: error.message };
    }
  }

  /**
   * 检查可用内存
   */
  private async checkMemory(ipAddress: string): Promise<{ availableMB: number; raw: string }> {
    try {
      const cmd = `ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no root@${ipAddress} "free -m | grep Mem | awk '{print \\$7}'"`;
      const { stdout } = await execAsync(cmd, { timeout: this.SSH_TIMEOUT });

      const availableMB = parseInt(stdout.trim(), 10) || 0;
      return { availableMB, raw: stdout.trim() };
    } catch (error) {
      this.logger.debug(`[诊断] 检查内存失败: ${error.message}`);
      return { availableMB: 0, raw: error.message };
    }
  }

  /**
   * 生成修复方案
   */
  private generateRepairPlan(result: DiagnosisResult): RepairAction[] {
    const actions: RepairAction[] = [];

    // 优先级 1：磁盘满优先处理
    if (result.diskUsagePercent > 90) {
      this.logger.warn(`[诊断] 磁盘使用率过高: ${result.diskUsagePercent}%`);
      actions.push({ type: 'clear_logs' });
    }

    // 优先级 2：代理服务异常
    if (result.proxyStatus === 'stopped' || result.proxyStatus === 'errored') {
      this.logger.warn(`[诊断] 代理服务异常: ${result.proxyStatus}`);
      actions.push({ type: 'restart_proxy' });
    } else if (result.proxyStatus === 'online' && !result.port8081Open) {
      // 代理显示运行但端口不通（僵尸进程）
      this.logger.warn(`[诊断] 代理服务僵尸进程，端口 8081 不通`);
      actions.push({ type: 'kill_port_8081' });
      actions.push({ type: 'restart_proxy' });
    }

    // 优先级 3：Freqtrade 异常
    if (result.freqtradeStatus === 'exited' || result.freqtradeStatus === 'restarting') {
      this.logger.warn(`[诊断] Freqtrade 异常: ${result.freqtradeStatus}`);
      actions.push({ type: 'restart_freqtrade' });
    }

    // 优先级 4：内存不足
    if (result.memoryAvailableMB > 0 && result.memoryAvailableMB < 100) {
      this.logger.warn(`[诊断] 可用内存不足: ${result.memoryAvailableMB}MB`);
      // 内存不足时，清理日志可能有帮助
      if (!actions.find((a) => a.type === 'clear_logs')) {
        actions.push({ type: 'clear_logs' });
      }
    }

    // 如果没有具体问题但心跳还是不通，最后手段：重启 VPS
    if (actions.length === 0) {
      this.logger.warn(`[诊断] 未发现具体问题，建议重启 VPS`);
      actions.push({ type: 'reboot_vps' });
    }

    return actions;
  }
}
