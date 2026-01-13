/**
 * v0.app 获取生成的代码
 */

import { v0 } from 'v0-sdk';

// 设置 API Token
process.env.V0_API_KEY = 'v1:26xzL1Fetn3agA3ROiaUNYTQ:fBw2Cwh8TiDyiUEL9EKM4thK';

interface ChatResult {
  name: string;
  chatId: string;
  files: { name: string; content: string }[];
}

async function fetchChatCode(chatId: string, name: string): Promise<ChatResult> {
  try {
    console.log(`📥 获取 ${name} (${chatId}) 的代码...`);

    // 使用正确的 getById 方法
    const chat = await v0.chats.getById({ chatId });

    console.log(`✅ ${name} 获取成功`);

    // 提取文件内容
    const files: { name: string; content: string }[] = [];

    if (chat.latestVersion?.files) {
      for (const file of chat.latestVersion.files) {
        files.push({
          name: file.name,
          content: file.content,
        });
      }
    }

    console.log(`   找到 ${files.length} 个文件`);
    files.forEach(f => console.log(`   - ${f.name}`));

    return { name, chatId, files };
  } catch (error) {
    console.error(`❌ ${name} 获取失败:`, error);
    throw error;
  }
}

async function main() {
  const chats = [
    { id: 'rmxMI1ek0qO', name: 'Dashboard 资产卡片' },
    { id: 'uCa4fJ7evee', name: 'Trading 控制台' },
    { id: 'sMmw7wdGtWr', name: '策略卡片' },
  ];

  const results: ChatResult[] = [];

  for (const chat of chats) {
    try {
      const result = await fetchChatCode(chat.id, chat.name);
      results.push(result);
    } catch (error) {
      console.error(`跳过 ${chat.name}`);
    }
  }

  // 输出所有代码
  console.log('\n' + '='.repeat(80));
  console.log('生成的代码');
  console.log('='.repeat(80) + '\n');

  for (const result of results) {
    console.log(`\n### ${result.name} ###\n`);
    for (const file of result.files) {
      console.log(`--- ${file.name} ---`);
      console.log(file.content);
      console.log('');
    }
  }
}

main();
