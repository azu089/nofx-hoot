-- AlterTable: 添加用户短 ID（自增数字，从 10001 起步）
ALTER TABLE "users" ADD COLUMN "uid" SERIAL NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "users_uid_key" ON "users"("uid");

-- 按注册时间重排 uid，确保第一个用户 = 10001
UPDATE users SET uid = uid + 10000;
WITH ranked AS (
  SELECT id, (ROW_NUMBER() OVER (ORDER BY created_at ASC)) + 10000 AS new_uid
  FROM users
)
UPDATE users SET uid = ranked.new_uid FROM ranked WHERE users.id = ranked.id;

-- 重置序列为当前最大值 +1，新注册用户继续递增
SELECT setval(pg_get_serial_sequence('users', 'uid'), (SELECT MAX(uid) FROM users));
