-- 权益快照表（对齐 nofx saveEquitySnapshot）
-- 每个策略周期记录一次账户权益状态，用于日 PnL 计算和绩效分析

CREATE TABLE IF NOT EXISTS "equity_snapshots" (
    "id"             TEXT NOT NULL,
    "strategy_id"    TEXT NOT NULL,
    "equity"         DECIMAL(18,8) NOT NULL,
    "avail_balance"  DECIMAL(18,8) NOT NULL,
    "position_value" DECIMAL(18,8) NOT NULL,
    "unrealized_pnl" DECIMAL(18,8) NOT NULL,
    "timestamp"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "equity_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "equity_snapshots_strategy_id_timestamp_idx"
    ON "equity_snapshots"("strategy_id", "timestamp");
