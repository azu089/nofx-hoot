-- AlterTable: 添加用户短 ID（自增数字）
ALTER TABLE "users" ADD COLUMN "uid" SERIAL NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "users_uid_key" ON "users"("uid");
