/**
 * V0 代码获取脚本
 * 使用方法: pnpm v0:fetch <chat-id> <component-name>
 */

import { v0 } from 'v0-sdk';
import * as fs from 'fs';
import * as path from 'path';

// 从环境变量或直接使用
const V0_API_KEY = process.env.V0_API_KEY || 'v1:26xzL1Fetn3agA3ROiaUNYTQ:fBw2Cwh8TiDyiUEL9EKM4thK';
process.env.V0_API_KEY = V0_API_KEY;

// 输出目录
const OUTPUT_DIR = path.join(__dirname, '../../apps/web/src/components/ui-v3/mobile');

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log('使用方法: pnpm v0:fetch <chat-id> <component-name>');
    console.log('示例: pnpm v0:fetch abc123xyz MobileWallet');
    process.exit(1);
  }

  const chatId = args[0];
  const componentName = args[1];

  console.log('📥 V0 Code Fetcher');
  console.log('==================');
  console.log(`Chat ID: ${chatId}`);
  console.log(`组件名称: ${componentName}`);
  console.log('');

  try {
    // 获取版本列表
    const versions = await v0.chats.findVersions({ chatId }) as any;

    if (!versions?.data?.length) {
      console.error('❌ 未找到任何版本');
      process.exit(1);
    }

    const versionId = versions.data[0].id;
    console.log(`📦 获取版本: ${versionId}`);

    // 获取版本详情
    const versionDetail = await v0.chats.getVersion({ chatId, versionId }) as any;

    if (!versionDetail?.files?.length) {
      console.error('❌ 未找到任何文件');
      process.exit(1);
    }

    // 过滤 TSX 文件，按大小排序取最大的
    const tsxFiles = versionDetail.files
      .filter((f: any) => f.name.endsWith('.tsx'))
      .sort((a: any, b: any) => b.content.length - a.content.length);

    if (!tsxFiles.length) {
      console.error('❌ 未找到 TSX 文件');
      process.exit(1);
    }

    const mainFile = tsxFiles[0];

    // 转换文件名: MobileWallet -> mobile-wallet.tsx
    const fileName = componentName
      .replace(/([A-Z])/g, '-$1')
      .toLowerCase()
      .replace(/^-/, '') + '.tsx';

    const filePath = path.join(OUTPUT_DIR, fileName);

    // 确保目录存在
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // 保存文件
    fs.writeFileSync(filePath, mainFile.content);

    console.log('');
    console.log('✅ 保存成功!');
    console.log(`📁 文件: ${filePath}`);
    console.log(`📏 大小: ${mainFile.content.length} 字符`);
    console.log('');
    console.log('下一步:');
    console.log('1. 检查组件导出名称');
    console.log('2. 添加到 preview/page.tsx');
    console.log('3. 测试组件功能');

  } catch (error) {
    console.error('❌ 获取失败:', error);
    process.exit(1);
  }
}

main();
