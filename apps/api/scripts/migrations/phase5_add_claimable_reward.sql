-- Phase 5: 添加 claimable_reward 字段到 stakes 表
-- 用于存储待领取的质押收益

-- 添加 claimable_reward 字段（如果不存在）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stakes' AND column_name = 'claimable_reward'
  ) THEN
    ALTER TABLE stakes
    ADD COLUMN claimable_reward DECIMAL(18, 8) DEFAULT 0 NOT NULL;

    COMMENT ON COLUMN stakes.claimable_reward IS '待领取的质押收益（由 StakingRewardsTask 分配）';
  END IF;
END $$;

-- 验证
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'stakes'
ORDER BY ordinal_position;
