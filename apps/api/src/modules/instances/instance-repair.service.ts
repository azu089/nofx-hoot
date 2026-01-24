import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import { RepairAction } from './instance-diagnosis.service';

const execAsync = promisify(exec);

/**
 * 修复结果接口
 */
export interface RepairResult {
  success: boolean;
  actionsExecuted: string[];
  actionsFailed: string[];
  logs: string[];
}

/**
 * VPS 实例修复服务
 * 通过 SSH 执行修复命令
 */
@Injectable()
export class InstanceRepairService {
  private readonly logger = new Logger(InstanceRepairService.name);

  // SSH 命令超时（毫秒）
  private readonly SSH_TIMEOUT = 60000;

  // 修复命令映射
  private readonly REPAIR_COMMANDS: Record<string, string> = {
    restart_proxy: 'pm2 restart quantfi-proxy',
    restart_freqtrade: 'cd /opt/quantfi && docker compose up -d',
    kill_port_8081: 'fuser -k 8081/tcp 2>/dev/null || true',
    clear_logs: 'truncate -s 0 /opt/quantfi/logs/*.log 2>/dev/null; docker logs freqtrade --tail 0 2>/dev/null',
    reboot_vps: 'reboot',
  };

  /**
   * 执行修复动作
   * @param ipAddress VPS IP 地址
   * @param actions 修复动作列表
   * @returns 修复结果
   */
  async executeRepair(ipAddress: string, actions: RepairAction[]): Promise<RepairResult> {
    const result: RepairResult = {
      success: false,
      actionsExecuted: [],
      actionsFailed: [],
      logs: [],
    };

    if (actions.length === 0) {
      result.success = true;
      result.logs.push('无需修复动作');
      return result;
    }

    this.logger.log(`[修复] 开始修复 VPS: ${ipAddress}, 动作数: ${actions.length}`);

    for (const action of actions) {
      if (action.type === 'none') {
        result.logs.push(`跳过: ${action.reason}`);
        continue;
      }

      const cmd = this.REPAIR_COMMANDS[action.type];
      if (!cmd) {
        result.logs.push(`未知动作类型: ${action.type}`);
        result.actionsFailed.push(action.type);
        continue;
      }

      try {
        this.logger.log(`[修复] 执行动作: ${action.type}`);
        result.logs.push(`执行: ${action.type}`);

        await this.executeSSHCommand(ipAddress, cmd);

        result.actionsExecuted.push(action.type);
        result.logs.push(`成功: ${action.type}`);

        // 每个动作执行后等待一下，让服务有时间启动
        if (action.type !== 'reboot_vps') {
          await this.sleep(5000);
        }
      } catch (error) {
        this.logger.error(`[修复] 动作失败: ${action.type}, ${error.message}`);
        result.actionsFailed.push(action.type);
        result.logs.push(`失败: ${action.type} - ${error.message}`);
      }
    }

    // 如果执行了重启 VPS，需要等待更长时间
    if (result.actionsExecuted.includes('reboot_vps')) {
      this.logger.log(`[修复] VPS 重启中，等待 2 分钟...`);
      result.logs.push('VPS 重启中，等待恢复...');
      await this.sleep(120000);
    } else if (result.actionsExecuted.length > 0) {
      // 等待服务恢复
      this.logger.log(`[修复] 等待服务恢复...`);
      await this.sleep(10000);
    }

    // 判断修复是否成功（至少有一个动作成功执行）
    result.success = result.actionsExecuted.length > 0 && result.actionsFailed.length === 0;

    this.logger.log(
      `[修复] 修复完成: ${ipAddress}, ` +
        `成功=${result.actionsExecuted.length}, 失败=${result.actionsFailed.length}`,
    );

    return result;
  }

  /**
   * 执行单个 SSH 命令
   */
  private async executeSSHCommand(ipAddress: string, command: string): Promise<string> {
    const sshCmd = `ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no root@${ipAddress} "${command}"`;

    try {
      const { stdout, stderr } = await execAsync(sshCmd, { timeout: this.SSH_TIMEOUT });
      return stdout + stderr;
    } catch (error) {
      // 对于 reboot 命令，连接断开是正常的
      if (command === 'reboot' && error.message.includes('Connection')) {
        return 'VPS 正在重启';
      }
      throw error;
    }
  }

  /**
   * 验证修复结果
   * 通过检查心跳接口是否恢复来判断
   */
  async verifyRepair(ipAddress: string): Promise<boolean> {
    try {
      // 尝试访问代理服务的健康检查接口
      const cmd = `curl -s -o /dev/null -w '%{http_code}' --connect-timeout 5 http://${ipAddress}:8081/api/health`;
      const { stdout } = await execAsync(cmd, { timeout: 10000 });

      const httpCode = parseInt(stdout.trim(), 10);
      const isHealthy = httpCode === 200;

      this.logger.log(`[修复] 验证结果: ${ipAddress}, HTTP=${httpCode}, 健康=${isHealthy}`);

      return isHealthy;
    } catch (error) {
      this.logger.debug(`[修复] 验证失败: ${ipAddress}, ${error.message}`);
      return false;
    }
  }

  /**
   * 休眠
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
