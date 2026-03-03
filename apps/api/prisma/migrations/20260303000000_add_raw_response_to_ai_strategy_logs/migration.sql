-- AddColumn
ALTER TABLE "ai_strategy_logs" ADD COLUMN IF NOT EXISTS "raw_response" TEXT;
