-- AlterTable
ALTER TABLE "users" ADD COLUMN "role" VARCHAR(20) NOT NULL DEFAULT 'user';

-- 为现有用户设置默认角色
UPDATE "users" SET "role" = 'user' WHERE "role" IS NULL OR "role" = '';

-- 可选：创建索引以提升查询性能
CREATE INDEX IF NOT EXISTS "idx_users_role" ON "users"("role");
