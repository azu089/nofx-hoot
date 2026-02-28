-- AlterTable: 添加 positions 表中缺少的列（schema 与数据库不同步修复）

-- 交易配置列
ALTER TABLE "positions" ADD COLUMN IF NOT EXISTS "trading_type" TEXT NOT NULL DEFAULT 'spot';
ALTER TABLE "positions" ADD COLUMN IF NOT EXISTS "leverage" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "positions" ADD COLUMN IF NOT EXISTS "margin" DECIMAL(18,8) NOT NULL DEFAULT 0;
ALTER TABLE "positions" ADD COLUMN IF NOT EXISTS "margin_mode" TEXT NOT NULL DEFAULT 'cross';

-- 实时数据列（可空）
ALTER TABLE "positions" ADD COLUMN IF NOT EXISTS "mark_price" DECIMAL(18,8);
ALTER TABLE "positions" ADD COLUMN IF NOT EXISTS "liquidation_price" DECIMAL(18,8);
ALTER TABLE "positions" ADD COLUMN IF NOT EXISTS "unrealized_pnl" DECIMAL(18,8);
ALTER TABLE "positions" ADD COLUMN IF NOT EXISTS "margin_ratio" DECIMAL(10,4);
ALTER TABLE "positions" ADD COLUMN IF NOT EXISTS "last_sync_at" TIMESTAMP(3);

-- DEX 相关列（可空）
ALTER TABLE "positions" ADD COLUMN IF NOT EXISTS "exchange_type" TEXT DEFAULT 'cex';
ALTER TABLE "positions" ADD COLUMN IF NOT EXISTS "tx_hash" TEXT;

-- 关联列（可空）
ALTER TABLE "positions" ADD COLUMN IF NOT EXISTS "api_key_id" TEXT;
ALTER TABLE "positions" ADD COLUMN IF NOT EXISTS "subscription_id" TEXT;

-- 平仓相关列（可空）
ALTER TABLE "positions" ADD COLUMN IF NOT EXISTS "exit_price" DECIMAL(18,8);
ALTER TABLE "positions" ADD COLUMN IF NOT EXISTS "close_reason" TEXT;
ALTER TABLE "positions" ADD COLUMN IF NOT EXISTS "realized_pnl" DECIMAL(18,8);

-- AI 交易来源列（可空）
ALTER TABLE "positions" ADD COLUMN IF NOT EXISTS "source" TEXT;
ALTER TABLE "positions" ADD COLUMN IF NOT EXISTS "ai_strategy_id" TEXT;
ALTER TABLE "positions" ADD COLUMN IF NOT EXISTS "high_water_mark" DECIMAL(10,4);

-- DCA 补仓列
ALTER TABLE "positions" ADD COLUMN IF NOT EXISTS "dca_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "positions" ADD COLUMN IF NOT EXISTS "last_dca_at" TIMESTAMP(3);

-- 外键约束（IF NOT EXISTS 防止重复添加）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'positions_subscription_id_fkey'
  ) THEN
    ALTER TABLE "positions" ADD CONSTRAINT "positions_subscription_id_fkey"
      FOREIGN KEY ("subscription_id") REFERENCES "strategy_subscriptions"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'positions_ai_strategy_id_fkey'
  ) THEN
    -- ai_strategies 表存在时才添加外键
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'ai_strategies') THEN
      ALTER TABLE "positions" ADD CONSTRAINT "positions_ai_strategy_id_fkey"
        FOREIGN KEY ("ai_strategy_id") REFERENCES "ai_strategies"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
  END IF;
END $$;
