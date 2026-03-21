-- 极速策略增强 Task 5: 真实交易成本字段
-- Position 表新增 3 个字段，记录交易所层面的真实成本

ALTER TABLE "positions" ADD COLUMN IF NOT EXISTS "gross_pnl" DECIMAL(18,8);
ALTER TABLE "positions" ADD COLUMN IF NOT EXISTS "trading_fees" DECIMAL(18,8);
ALTER TABLE "positions" ADD COLUMN IF NOT EXISTS "funding_fees" DECIMAL(18,8);

-- 注: 旧 position 这 3 个字段为 NULL，兼容处理在代码层（grossPnl 为空时 pnl 沿用旧值）
