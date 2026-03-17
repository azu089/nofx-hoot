-- AlterTable
ALTER TABLE "positions" ADD COLUMN "exchange_ref" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "positions_exchange_ref_key" ON "positions"("exchange_ref");
