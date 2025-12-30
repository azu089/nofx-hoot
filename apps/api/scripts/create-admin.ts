/**
 * 创建测试管理员账号脚本
 *
 * 使用方法：
 * cd apps/api && npx ts-node scripts/create-admin.ts
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@quantfi.com';
  const password = 'Admin123456';
  const role = 'admin';

  // 检查是否已存在
  const existing = await prisma.users.findUnique({
    where: { email },
  });

  if (existing) {
    // 更新角色为 admin
    await prisma.users.update({
      where: { email },
      data: { role },
    });
    console.log(`✅ 管理员账号已存在，已更新角色为 ${role}`);
    console.log(`   邮箱: ${email}`);
    console.log(`   密码: ${password}`);
  } else {
    // 创建新管理员
    const passwordHash = await bcrypt.hash(password, 10);

    await prisma.users.create({
      data: {
        email,
        password_hash: passwordHash,
        role,
        vip_level: 9,
        status: 'active',
      },
    });
    console.log(`✅ 管理员账号创建成功`);
    console.log(`   邮箱: ${email}`);
    console.log(`   密码: ${password}`);
    console.log(`   角色: ${role}`);
  }
}

main()
  .catch((e) => {
    console.error('❌ 创建失败:', e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
