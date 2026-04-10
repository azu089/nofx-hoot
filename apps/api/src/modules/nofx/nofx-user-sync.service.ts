import { Injectable, Logger } from '@nestjs/common';
import { NofxClient } from './nofx.client';

/**
 * NofxUserSyncService —— "影子用户同步" 单一职责服务。
 *
 * 设计原则：
 * - HOOT 是用户唯一来源（商业核心拥有 user 表 + 登录）。
 * - nofx 是交易内核，需要一个**与 HOOT user_id 完全相同**的本地 user 行作为
 *   后续 X-User-Id header 的目标，否则 internal 路径会 404。
 * - 本 service 只做一件事：保证 nofx 端有一行 id == HOOT user_id 的用户。
 *
 * 调用语义（必须由调用方理解）：
 *
 * 1. **fire-and-forget**：本服务的所有方法**绝不抛错**给调用方。
 *    任何失败都被吞掉并 log，避免登录/注册因为 nofx 不可达而失败。
 *    HOOT 是商业核心，nofx 故障 ≠ HOOT 故障。
 *
 * 2. **进程级幂等缓存**：成功 upsert 过的 user_id 进 in-memory Set，
 *    后续调用零成本短路。LRU 简化为"无上限 Set"，因为 HOOT 单进程
 *    用户活跃集 ≤ 数十万，内存成本可忽略；进程重启自然清空。
 *
 * 3. **lazy ensure**：除了 register/login 主动调，nofx-proxy service 在每次
 *    代理 HOOT user 请求前也会调一次（自然回填老用户）。
 */
@Injectable()
export class NofxUserSyncService {
  private readonly logger = new Logger(NofxUserSyncService.name);
  private readonly synced = new Set<string>();

  constructor(private readonly client: NofxClient) {}

  /**
   * 确保 nofx 端有一行 id=user.id 的用户。已同步过则零成本短路。
   * 永不抛错。
   */
  async ensureShadowUser(user: { id: string; email?: string | null }): Promise<void> {
    if (!user?.id) return;
    if (this.synced.has(user.id)) return;
    if (!this.client.isConfigured) return; // nofx 接入未启用，静默跳过

    const email = user.email ?? `${user.id}@hoot.local`;
    try {
      // 公共路由，不带 X-User-Id；nofx 端用 X-Internal-Token 校验调用方身份。
      await this.client.post('/api/internal/users/upsert', { id: user.id, email });
      this.synced.add(user.id);
      this.logger.log(`[nofx] shadow user upserted id=${user.id}`);
    } catch (err: unknown) {
      // 不抛、不缓存（下次还会重试）
      const msg = (err as Error)?.message ?? 'unknown';
      this.logger.warn(`[nofx] shadow user upsert failed id=${user.id} err=${msg}`);
    }
  }

  /**
   * 强制重新同步：在 nofx 端报"user not found"时由 NofxService 调用，
   * 用以清除可能因 nofx 重启/DB 重置而陈旧的缓存条目。
   */
  async forceResync(user: { id: string; email?: string | null }): Promise<void> {
    if (!user?.id) return;
    this.synced.delete(user.id);
    await this.ensureShadowUser(user);
  }
}
