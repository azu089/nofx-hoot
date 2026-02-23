-- AlterTable
ALTER TABLE "ai_configs" ADD COLUMN     "locale" TEXT NOT NULL DEFAULT 'zh-CN',
ALTER COLUMN "max_position_size" SET DEFAULT 20;

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "user_agent" TEXT,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_token_idx" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "ai_memories_user_id_symbol_created_at_idx" ON "ai_memories"("user_id", "symbol", "created_at");

-- CreateIndex
CREATE INDEX "ai_strategies_is_public_total_trades_idx" ON "ai_strategies"("is_public", "total_trades");

-- CreateIndex
CREATE INDEX "api_keys_user_id_exchange_is_active_idx" ON "api_keys"("user_id", "exchange", "is_active");

-- CreateIndex
CREATE INDEX "positions_ai_strategy_id_status_closed_at_idx" ON "positions"("ai_strategy_id", "status", "closed_at");

-- CreateIndex
CREATE INDEX "transactions_user_id_type_created_at_idx" ON "transactions"("user_id", "type", "created_at");

-- CreateIndex
CREATE INDEX "users_membership_status_membership_expire_at_idx" ON "users"("membership_status", "membership_expire_at");

-- CreateIndex
CREATE INDEX "withdraw_requests_status_created_at_idx" ON "withdraw_requests"("status", "created_at");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
