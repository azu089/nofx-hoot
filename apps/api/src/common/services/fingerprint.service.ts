import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as crypto from 'crypto';

/**
 * 设备指纹信息
 */
export interface DeviceFingerprint {
  hash: string; // 指纹哈希
  components: {
    userAgent?: string;
    language?: string;
    platform?: string;
    timezone?: string;
    screenResolution?: string;
    colorDepth?: number;
    hardwareConcurrency?: number;
    deviceMemory?: number;
    canvas?: string;
    webgl?: string;
    fonts?: string[];
    plugins?: string[];
    touchSupport?: boolean;
    cookiesEnabled?: boolean;
    localStorage?: boolean;
    sessionStorage?: boolean;
  };
  createdAt: string;
  lastSeenAt: string;
  loginCount: number;
}

/**
 * 设备指纹检查结果
 */
export interface FingerprintCheckResult {
  isNew: boolean; // 是否新设备
  isSuspicious: boolean; // 是否可疑（可能多账号）
  suspiciousReason?: string; // 可疑原因
  linkedAccounts?: number; // 关联账号数量
  riskLevel: 'low' | 'medium' | 'high'; // 风险等级
}

/**
 * 设备指纹服务
 * 用于反作弊：检测多账号、设备关联
 */
@Injectable()
export class FingerprintService {
  private readonly logger = new Logger(FingerprintService.name);
  private readonly MAX_ACCOUNTS_PER_DEVICE = 2; // 同一设备最多允许的账号数
  private readonly MAX_DEVICES_PER_ACCOUNT = 5; // 同一账号最多允许的设备数

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 生成设备指纹哈希
   * @param components 指纹组件
   */
  generateFingerprintHash(components: DeviceFingerprint['components']): string {
    // 提取关键特征生成哈希
    const keyFeatures = [
      components.userAgent || '',
      components.platform || '',
      components.timezone || '',
      components.screenResolution || '',
      components.colorDepth?.toString() || '',
      components.hardwareConcurrency?.toString() || '',
      components.canvas || '',
      components.webgl || '',
    ].join('|');

    return crypto.createHash('sha256').update(keyFeatures).digest('hex').substring(0, 32);
  }

  /**
   * 记录设备指纹
   * @param userId 用户 ID
   * @param fingerprint 设备指纹
   */
  async recordFingerprint(userId: string, fingerprint: Partial<DeviceFingerprint>): Promise<FingerprintCheckResult> {
    const user = await this.prisma.client.users.findUnique({
      where: { id: userId },
      select: { device_fingerprints: true, email: true },
    });

    if (!user) {
      throw new BadRequestException('用户不存在');
    }

    // 生成指纹哈希（如果前端没有提供）
    const hash = fingerprint.hash || this.generateFingerprintHash(fingerprint.components || {});
    const now = new Date().toISOString();

    // 获取现有指纹列表
    const existingFingerprints = (user.device_fingerprints as unknown as DeviceFingerprint[]) || [];

    // 检查是否已存在此指纹
    const existingIndex = existingFingerprints.findIndex((fp) => fp.hash === hash);

    let checkResult: FingerprintCheckResult;

    if (existingIndex >= 0) {
      // 更新现有指纹
      existingFingerprints[existingIndex].lastSeenAt = now;
      existingFingerprints[existingIndex].loginCount += 1;

      checkResult = {
        isNew: false,
        isSuspicious: false,
        riskLevel: 'low',
      };
    } else {
      // 新设备
      // 检查该指纹是否在其他账号使用
      const linkedAccountsResult = await this.checkFingerprintInOtherAccounts(hash, userId);

      // 添加新指纹
      const newFingerprint: DeviceFingerprint = {
        hash,
        components: fingerprint.components || {},
        createdAt: now,
        lastSeenAt: now,
        loginCount: 1,
      };

      // 检查是否超过最大设备数
      if (existingFingerprints.length >= this.MAX_DEVICES_PER_ACCOUNT) {
        // 移除最旧的设备
        existingFingerprints.sort(
          (a, b) => new Date(a.lastSeenAt).getTime() - new Date(b.lastSeenAt).getTime(),
        );
        existingFingerprints.shift();
      }

      existingFingerprints.push(newFingerprint);

      // 判断风险等级
      let riskLevel: 'low' | 'medium' | 'high' = 'low';
      let isSuspicious = false;
      let suspiciousReason: string | undefined;

      if (linkedAccountsResult.count >= this.MAX_ACCOUNTS_PER_DEVICE) {
        riskLevel = 'high';
        isSuspicious = true;
        suspiciousReason = `该设备已关联 ${linkedAccountsResult.count} 个账号，超过限制`;
      } else if (linkedAccountsResult.count > 0) {
        riskLevel = 'medium';
        isSuspicious = true;
        suspiciousReason = `该设备已关联 ${linkedAccountsResult.count} 个其他账号`;
      }

      checkResult = {
        isNew: true,
        isSuspicious,
        suspiciousReason,
        linkedAccounts: linkedAccountsResult.count,
        riskLevel,
      };

      // 记录可疑日志
      if (isSuspicious) {
        this.logger.warn(
          `可疑设备登录: 用户 ${userId} (${user.email}), 指纹 ${hash.substring(0, 8)}..., 原因: ${suspiciousReason}`,
        );
      }
    }

    // 更新用户的设备指纹
    await this.prisma.client.users.update({
      where: { id: userId },
      data: {
        device_fingerprints: existingFingerprints as any,
        updated_at: new Date(),
      },
    });

    this.logger.log(`设备指纹记录: 用户 ${userId}, 指纹 ${hash.substring(0, 8)}..., 新设备: ${checkResult.isNew}`);

    return checkResult;
  }

  /**
   * 检查指纹是否在其他账号使用
   * @param hash 指纹哈希
   * @param excludeUserId 排除的用户 ID
   */
  async checkFingerprintInOtherAccounts(
    hash: string,
    excludeUserId: string,
  ): Promise<{ count: number; userIds: string[] }> {
    // 搜索所有用户的 device_fingerprints 字段
    const users = await this.prisma.client.users.findMany({
      where: {
        id: { not: excludeUserId },
        device_fingerprints: {
          not: { equals: null },
        },
      },
      select: {
        id: true,
        device_fingerprints: true,
      },
    });

    const linkedUserIds: string[] = [];

    for (const user of users) {
      const fingerprints = (user.device_fingerprints as unknown as DeviceFingerprint[]) || [];
      if (fingerprints.some((fp) => fp.hash === hash)) {
        linkedUserIds.push(user.id);
      }
    }

    return {
      count: linkedUserIds.length,
      userIds: linkedUserIds,
    };
  }

  /**
   * 获取用户的设备列表
   * @param userId 用户 ID
   */
  async getUserDevices(userId: string): Promise<DeviceFingerprint[]> {
    const user = await this.prisma.client.users.findUnique({
      where: { id: userId },
      select: { device_fingerprints: true },
    });

    if (!user) {
      throw new BadRequestException('用户不存在');
    }

    return (user.device_fingerprints as unknown as DeviceFingerprint[]) || [];
  }

  /**
   * 删除用户的某个设备
   * @param userId 用户 ID
   * @param fingerprintHash 设备指纹哈希
   */
  async removeDevice(userId: string, fingerprintHash: string): Promise<void> {
    const user = await this.prisma.client.users.findUnique({
      where: { id: userId },
      select: { device_fingerprints: true },
    });

    if (!user) {
      throw new BadRequestException('用户不存在');
    }

    const fingerprints = (user.device_fingerprints as unknown as DeviceFingerprint[]) || [];
    const updatedFingerprints = fingerprints.filter((fp) => fp.hash !== fingerprintHash);

    await this.prisma.client.users.update({
      where: { id: userId },
      data: {
        device_fingerprints: updatedFingerprints as any,
        updated_at: new Date(),
      },
    });

    this.logger.log(`设备删除: 用户 ${userId}, 指纹 ${fingerprintHash.substring(0, 8)}...`);
  }

  /**
   * 清除用户所有设备
   * @param userId 用户 ID
   */
  async clearAllDevices(userId: string): Promise<void> {
    await this.prisma.client.users.update({
      where: { id: userId },
      data: {
        device_fingerprints: [],
        updated_at: new Date(),
      },
    });

    this.logger.log(`清除所有设备: 用户 ${userId}`);
  }

  /**
   * 检查设备是否被允许（用于登录/注册时的前置检查）
   * @param fingerprintHash 设备指纹哈希
   */
  async isDeviceAllowed(fingerprintHash: string): Promise<{ allowed: boolean; reason?: string }> {
    // 查找使用该指纹的所有账号
    const users = await this.prisma.client.users.findMany({
      where: {
        device_fingerprints: {
          not: { equals: null },
        },
      },
      select: {
        id: true,
        device_fingerprints: true,
        status: true,
      },
    });

    const linkedUsers: string[] = [];

    for (const user of users) {
      const fingerprints = (user.device_fingerprints as unknown as DeviceFingerprint[]) || [];
      if (fingerprints.some((fp) => fp.hash === fingerprintHash)) {
        linkedUsers.push(user.id);

        // 检查是否有被封禁的账号
        if (user.status === 'banned' || user.status === 'suspended') {
          return {
            allowed: false,
            reason: '该设备关联的账号已被封禁，无法注册新账号',
          };
        }
      }
    }

    // 检查是否超过最大账号数
    if (linkedUsers.length >= this.MAX_ACCOUNTS_PER_DEVICE) {
      return {
        allowed: false,
        reason: `该设备已注册 ${linkedUsers.length} 个账号，已达上限`,
      };
    }

    return { allowed: true };
  }

  /**
   * 获取设备风险评分（用于反作弊）
   * @param userId 用户 ID
   * @param fingerprintHash 设备指纹哈希
   * @param ipAddress IP 地址
   */
  async calculateRiskScore(
    userId: string,
    fingerprintHash: string,
    ipAddress?: string,
  ): Promise<{ score: number; factors: string[] }> {
    const factors: string[] = [];
    let score = 0;

    // 1. 检查设备关联账号数
    const linkedAccounts = await this.checkFingerprintInOtherAccounts(fingerprintHash, userId);
    if (linkedAccounts.count > 0) {
      score += linkedAccounts.count * 20;
      factors.push(`设备关联 ${linkedAccounts.count} 个其他账号`);
    }

    // 2. 检查是否新设备
    const user = await this.prisma.client.users.findUnique({
      where: { id: userId },
      select: { device_fingerprints: true, created_at: true },
    });

    if (user) {
      const fingerprints = (user.device_fingerprints as unknown as DeviceFingerprint[]) || [];
      const existingDevice = fingerprints.find((fp) => fp.hash === fingerprintHash);

      if (!existingDevice) {
        score += 10;
        factors.push('新设备登录');
      }

      // 3. 检查账号年龄
      const accountAge = Date.now() - new Date(user.created_at).getTime();
      const accountAgeDays = accountAge / (1000 * 60 * 60 * 24);

      if (accountAgeDays < 1) {
        score += 15;
        factors.push('账号创建不足 24 小时');
      } else if (accountAgeDays < 7) {
        score += 5;
        factors.push('账号创建不足 7 天');
      }
    }

    // 4. IP 相关检查（如果提供）
    if (ipAddress) {
      // TODO: 可以添加 IP 地理位置检查、代理检测等
    }

    return { score: Math.min(score, 100), factors };
  }
}
