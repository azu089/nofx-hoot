import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * NofxEventsService —— 接收 nofx → HOOT webhook 事件并幂等持久化。
 *
 * P5 阶段范围（明确不做的事）：
 * - 不扣钱包余额
 * - 不写 BillingLog
 * - 不动 MembershipSubscription
 * - 不通知用户
 *
 * 仅做：按 event_id 幂等 upsert 到 nofx_events 表，写 receivedAt。
 * 后续业务批次会在此基础上加扣费/订阅状态变更逻辑（带 processedAt 流转）。
 *
 * 幂等策略：用 Prisma upsert 按 id (= event_id uuid v4) 区分新旧。
 * 重放同 event_id 一律返回 duplicate=true，不更新已有行。
 */

export interface NofxEventEnvelope {
  event_id: string;
  type: string;
  timestamp?: string;
  payload: unknown;
}

export interface RecordResult {
  ok: true;
  duplicate: boolean;
  id: string;
}

@Injectable()
export class NofxEventsService {
  private readonly logger = new Logger(NofxEventsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(envelope: NofxEventEnvelope): Promise<RecordResult> {
    if (!envelope?.event_id || !envelope?.type) {
      throw new Error('event_id and type are required');
    }

    // 从 payload 中提取 user_id（每种事件类型 payload 都有 user_id 字段）
    const payloadUserId = (envelope.payload as { user_id?: string })?.user_id ?? null;
    if (!payloadUserId) {
      this.logger.warn(
        `[nofx-events] missing user_id in payload event_id=${envelope.event_id} type=${envelope.type}`,
      );
    }

    try {
      await this.prisma.nofxEvent.create({
        data: {
          id: envelope.event_id,
          userId: payloadUserId ?? '',
          type: envelope.type,
          payload: envelope.payload as Prisma.InputJsonValue,
        },
      });
      this.logger.log(
        `[nofx-events] received type=${envelope.type} event_id=${envelope.event_id} user=${payloadUserId ?? '-'}`,
      );
      return { ok: true, duplicate: false, id: envelope.event_id };
    } catch (err: unknown) {
      // P2002 = Prisma unique violation → event_id 已存在 → 视为幂等成功
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        this.logger.log(
          `[nofx-events] duplicate event_id=${envelope.event_id} (idempotent replay)`,
        );
        return { ok: true, duplicate: true, id: envelope.event_id };
      }
      throw err;
    }
  }
}
