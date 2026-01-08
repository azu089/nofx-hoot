/**
 * Telegram initData 签名验证测试脚本
 *
 * 使用方法：
 * npx ts-node scripts/test-telegram-signature.ts
 */

import * as crypto from 'crypto';

// 从环境变量获取 Bot Token
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8328612196:AAEDw1-RFFuAEo0-n_gm6dbXCONHkxKOM34';

/**
 * 生成有效的 Telegram initData
 * 用于测试目的
 */
function generateTestInitData(telegramUser: {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
}): string {
  const authDate = Math.floor(Date.now() / 1000);
  const userJson = JSON.stringify(telegramUser);

  const params = new URLSearchParams();
  params.append('auth_date', authDate.toString());
  params.append('user', userJson);

  // 按字母顺序排列
  const dataCheckArr: string[] = [];
  params.forEach((value, key) => {
    dataCheckArr.push(`${key}=${value}`);
  });
  dataCheckArr.sort();
  const dataCheckString = dataCheckArr.join('\n');

  // 计算签名
  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(BOT_TOKEN)
    .digest();

  const hash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  params.append('hash', hash);

  return params.toString();
}

/**
 * 验证 initData 签名
 */
function verifyInitData(initData: string): {
  valid: boolean;
  user?: any;
  authDate?: number;
  error?: string;
} {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');

    if (!hash) {
      return { valid: false, error: '缺少 hash' };
    }

    // 检查 auth_date
    const authDateStr = params.get('auth_date');
    if (!authDateStr) {
      return { valid: false, error: '缺少 auth_date' };
    }

    const authDate = parseInt(authDateStr, 10);
    const now = Math.floor(Date.now() / 1000);
    const maxAge = 5 * 60; // 5 分钟

    if (now - authDate > maxAge) {
      return { valid: false, error: `initData 已过期 (${now - authDate} 秒)` };
    }

    // 构建数据检查字符串
    const dataCheckArr: string[] = [];
    params.forEach((value, key) => {
      if (key !== 'hash') {
        dataCheckArr.push(`${key}=${value}`);
      }
    });
    dataCheckArr.sort();
    const dataCheckString = dataCheckArr.join('\n');

    // 计算签名
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(BOT_TOKEN)
      .digest();

    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    if (calculatedHash !== hash) {
      return { valid: false, error: '签名不匹配' };
    }

    // 解析用户信息
    const userStr = params.get('user');
    let user;
    if (userStr) {
      try {
        user = JSON.parse(userStr);
      } catch {
        return { valid: false, error: '用户信息格式错误' };
      }
    }

    return { valid: true, user, authDate };
  } catch (error) {
    return { valid: false, error: `验证失败: ${error}` };
  }
}

// ==================== 测试用例 ====================

console.log('='.repeat(60));
console.log('Telegram initData 签名验证测试');
console.log('='.repeat(60));
console.log('');

// 测试 1: 生成并验证有效的 initData
console.log('测试 1: 生成并验证有效的 initData');
console.log('-'.repeat(40));

const testUser = {
  id: 123456789,
  first_name: 'Test',
  last_name: 'User',
  username: 'testuser',
  language_code: 'zh-hans',
};

const validInitData = generateTestInitData(testUser);
console.log('生成的 initData:');
console.log(validInitData.substring(0, 100) + '...');
console.log('');

const result1 = verifyInitData(validInitData);
console.log('验证结果:', result1.valid ? '✅ 通过' : '❌ 失败');
if (result1.user) {
  console.log('用户信息:', JSON.stringify(result1.user, null, 2));
}
console.log('');

// 测试 2: 验证篡改后的 initData
console.log('测试 2: 验证篡改后的 initData');
console.log('-'.repeat(40));

const tamperedInitData = validInitData.replace('123456789', '999999999');
const result2 = verifyInitData(tamperedInitData);
console.log('验证结果:', result2.valid ? '✅ 通过' : '❌ 失败');
if (result2.error) {
  console.log('错误信息:', result2.error);
}
console.log('');

// 测试 3: 验证无 hash 的 initData
console.log('测试 3: 验证无 hash 的 initData');
console.log('-'.repeat(40));

const noHashInitData = 'auth_date=1234567890&user=%7B%22id%22%3A123%7D';
const result3 = verifyInitData(noHashInitData);
console.log('验证结果:', result3.valid ? '✅ 通过' : '❌ 失败');
if (result3.error) {
  console.log('错误信息:', result3.error);
}
console.log('');

// 测试 4: 验证过期的 initData
console.log('测试 4: 验证过期的 initData（模拟）');
console.log('-'.repeat(40));

// 创建一个 10 分钟前的 initData
const expiredAuthDate = Math.floor(Date.now() / 1000) - 600;
const expiredParams = new URLSearchParams();
expiredParams.append('auth_date', expiredAuthDate.toString());
expiredParams.append('user', JSON.stringify(testUser));

const expiredDataCheckArr: string[] = [];
expiredParams.forEach((value, key) => {
  expiredDataCheckArr.push(`${key}=${value}`);
});
expiredDataCheckArr.sort();
const expiredDataCheckString = expiredDataCheckArr.join('\n');

const expiredSecretKey = crypto
  .createHmac('sha256', 'WebAppData')
  .update(BOT_TOKEN)
  .digest();

const expiredHash = crypto
  .createHmac('sha256', expiredSecretKey)
  .update(expiredDataCheckString)
  .digest('hex');

expiredParams.append('hash', expiredHash);
const expiredInitData = expiredParams.toString();

const result4 = verifyInitData(expiredInitData);
console.log('验证结果:', result4.valid ? '✅ 通过' : '❌ 失败');
if (result4.error) {
  console.log('错误信息:', result4.error);
}
console.log('');

// 测试 5: 验证无用户名的用户
console.log('测试 5: 验证无用户名的用户');
console.log('-'.repeat(40));

const noUsernameUser = {
  id: 987654321,
  first_name: '无用户名',
};

const noUsernameInitData = generateTestInitData(noUsernameUser);
const result5 = verifyInitData(noUsernameInitData);
console.log('验证结果:', result5.valid ? '✅ 通过' : '❌ 失败');
if (result5.user) {
  console.log('用户信息:', JSON.stringify(result5.user, null, 2));
}
console.log('');

// 测试 6: 验证带特殊字符的用户名
console.log('测试 6: 验证带特殊字符的用户名');
console.log('-'.repeat(40));

const specialCharUser = {
  id: 111222333,
  first_name: '测试用户 🎉',
  username: 'test_user_123',
};

const specialCharInitData = generateTestInitData(specialCharUser);
const result6 = verifyInitData(specialCharInitData);
console.log('验证结果:', result6.valid ? '✅ 通过' : '❌ 失败');
if (result6.user) {
  console.log('用户信息:', JSON.stringify(result6.user, null, 2));
}
console.log('');

// 输出可用于 API 测试的 initData
console.log('='.repeat(60));
console.log('可用于 API 测试的 initData（5分钟内有效）:');
console.log('='.repeat(60));
console.log('');
console.log(validInitData);
console.log('');
console.log('使用方法:');
console.log('curl -X POST http://localhost:4001/api/telegram/auth \\');
console.log('  -H "Content-Type: application/json" \\');
console.log(`  -d '{"initData":"${validInitData}"}'`);
console.log('');

// 总结
console.log('='.repeat(60));
console.log('测试总结');
console.log('='.repeat(60));
console.log(`✅ 通过: ${[result1, result5, result6].filter(r => r.valid).length} 个`);
console.log(`❌ 失败: ${[result2, result3, result4].filter(r => !r.valid).length} 个 (预期失败)`);
console.log('');
