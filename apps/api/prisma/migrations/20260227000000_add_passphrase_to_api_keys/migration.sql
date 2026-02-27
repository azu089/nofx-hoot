-- AlterTable: 为 ApiKey 新增 OKX passphrase 加密存储字段
ALTER TABLE "api_keys" ADD COLUMN "encrypted_passphrase" TEXT;
ALTER TABLE "api_keys" ADD COLUMN "passphrase_iv" TEXT;
ALTER TABLE "api_keys" ADD COLUMN "passphrase_auth_tag" TEXT;
