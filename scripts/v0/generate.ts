/**
 * V0 UI 生成脚本
 * 使用方法: pnpm v0:generate <component-name> "<prompt>"
 */

import { v0 } from 'v0-sdk';

// 从环境变量或直接使用
const V0_API_KEY = process.env.V0_API_KEY || 'v1:26xzL1Fetn3agA3ROiaUNYTQ:fBw2Cwh8TiDyiUEL9EKM4thK';
process.env.V0_API_KEY = V0_API_KEY;

// 设计系统规范
const DESIGN_SYSTEM = `
You are an expert React developer creating mobile-first UI components for a crypto trading platform.

Design System:
- Background: #0A0A0F (primary), #12121A (cards), #1A1A24 (elevated)
- Border: #1E1E2E
- Accent: #06B6D4 (cyan)
- Success: #22C55E, Error: #EF4444
- Text: #FFFFFF (primary), #94A3B8 (secondary), #64748B (tertiary)

Requirements:
- React 19 with TypeScript
- TailwindCSS for styling (no shadcn/ui)
- Mobile-first responsive design (390px width)
- Dark theme only
- Use lucide-react for icons
- Include proper TypeScript types
- Use "use client" directive for client components
- All text in Chinese (中文)
- Add title and aria-label to buttons and form elements
- Use named exports (not default exports)
`;

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log('使用方法: pnpm v0:generate <component-name> "<prompt>"');
    console.log('示例: pnpm v0:generate MobileWallet "创建一个钱包页面，包含余额显示和转账功能"');
    process.exit(1);
  }

  const componentName = args[0];
  const prompt = args.slice(1).join(' ');

  console.log('🚀 V0 UI Generator');
  console.log('==================');
  console.log(`组件名称: ${componentName}`);
  console.log(`Prompt: ${prompt.substring(0, 100)}...`);
  console.log('');

  try {
    const chat = await v0.chats.create({
      message: prompt,
      system: DESIGN_SYSTEM,
    });

    console.log('✅ 生成成功!');
    console.log('');
    console.log(`📄 Chat ID: ${chat.id}`);
    console.log(`🔗 预览链接: ${chat.webUrl}`);
    console.log('');
    console.log('下一步:');
    console.log(`1. 访问上方链接查看生成效果`);
    console.log(`2. 如果满意，运行: pnpm v0:fetch ${chat.id} ${componentName}`);
    console.log(`3. 如果需要调整，在 v0.app 中继续对话`);

  } catch (error) {
    console.error('❌ 生成失败:', error);
    process.exit(1);
  }
}

main();
