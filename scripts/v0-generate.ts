/**
 * v0.app UI 生成脚本
 * 用于生成高保真 UI 组件
 */

import { v0 } from 'v0-sdk';

// 设置 API Token
const API_TOKEN = 'v1:26xzL1Fetn3agA3ROiaUNYTQ:fBw2Cwh8TiDyiUEL9EKM4thK';

// QuantFi 设计系统
const DESIGN_SYSTEM = `
## QuantFi Design System

### 配色（华尔街暗黑风格）
- 主背景: #0B0E11 (深黑蓝)
- 卡片背景: #131722 (次级背景)
- 输入框/悬浮: #1E222D
- 品牌蓝: #3772FF (主按钮/链接)
- 盈利绿: #00C087 (翡翠绿)
- 亏损红: #F23645 (玫瑰红)
- 警告橙: #F7931A
- 主文字: #FFFFFF
- 次要文字: #848E9C
- 边框: #2B3139

### 字体
- 主字体: Inter, SF Pro Display
- 数字: 等宽字体 tabular-nums

### 圆角
- 按钮: 6px
- 小卡片: 8px
- 大卡片: 12px
- 弹窗: 16px

### 特效
- 玻璃效果: backdrop-filter: blur(12px)
- 光晕: box-shadow: 0 0 20px rgba(55, 114, 255, 0.3)
- 悬浮: transform: translateY(-2px)
`;

// 生成 Dashboard 资产卡片
async function generateDashboardHeroCard() {
  console.log('🎨 正在生成 Dashboard 资产卡片...');

  const prompt = `
${DESIGN_SYSTEM}

## 需求：Dashboard 资产英雄卡片

创建一个金融级别的资产展示卡片，参考 Binance/OKX 移动端设计。

### 功能要求
1. 顶部：总资产 (大字号 48px 白色，等宽数字)
2. 今日盈亏：绿色或红色，带百分比
3. 点卡余额：橙色显示
4. 代币余额：紫色显示
5. 背景：渐变蓝色光晕效果
6. 右上角刷新按钮

### 样式要求
- 使用 Tailwind CSS
- 使用 lucide-react 图标
- 玻璃效果卡片 (backdrop-blur)
- 数字使用等宽字体 font-mono
- 盈利用 #00C087，亏损用 #F23645
- 卡片圆角 12px
- 内边距 20px
- 添加微妙的光晕动画

### 技术栈
- React + TypeScript
- Tailwind CSS
- lucide-react 图标库

只输出 React 组件代码，不要解释。
`;

  try {
    const chat = await v0.chats.create({
      message: prompt,
      system: '你是一个专业的金融产品 UI 设计师和 React 开发专家。你擅长创建高端、专业、精致的金融 SaaS 界面。',
    });

    console.log(`✅ Dashboard 卡片生成成功: ${chat.webUrl}`);
    return chat;
  } catch (error) {
    console.error('❌ 生成失败:', error);
    throw error;
  }
}

// 生成 Trading 控制台组件
async function generateTradingConsole() {
  console.log('🎨 正在生成 Trading 控制台...');

  const prompt = `
${DESIGN_SYSTEM}

## 需求：专业交易控制台

创建一个专业级别的交易控制台，参考 Binance Futures 移动端设计。

### 组件结构
1. 顶部账户总览卡片
   - 账户权益 (大字号)
   - 未实现盈亏
   - 今日已实现盈亏
   - 可用保证金

2. Tab 切换区
   - 持仓 / 历史 / 日志 三个 Tab
   - 下划线指示器动画

3. 持仓卡片
   - 交易对 + 方向标签 (多/空)
   - 杠杆倍数
   - 浮盈/浮亏 (大字号颜色区分)
   - 开仓价 / 当前价
   - 止盈止损进度条
   - AI 解读按钮
   - 平仓按钮

### 样式要求
- 暗黑主题
- 玻璃效果卡片
- 流畅的微动画
- 专业金融数据展示
- 紧凑但可读的布局

只输出 React 组件代码。
`;

  try {
    const chat = await v0.chats.create({
      message: prompt,
      system: '你是一个专业的量化交易平台 UI 设计师，擅长创建 Binance/OKX 级别的专业交易界面。',
    });

    console.log(`✅ Trading 控制台生成成功: ${chat.webUrl}`);
    return chat;
  } catch (error) {
    console.error('❌ 生成失败:', error);
    throw error;
  }
}

// 生成策略卡片
async function generateStrategyCard() {
  console.log('🎨 正在生成策略卡片...');

  const prompt = `
${DESIGN_SYSTEM}

## 需求：高端策略展示卡片

创建一个专业的量化策略展示卡片。

### 卡片内容
1. 顶部
   - 策略名称 (粗体)
   - 风险等级徽章 (低/中/高)
   - 标签 (现货/合约/AI)

2. 核心指标区
   - 历史年化收益: 15-25% (大字号绿色)
   - 最大回撤: -8% (红色)
   - 胜率: 68%
   - 夏普比率: 1.8

3. 迷你收益曲线图 (Sparkline)

4. 底部
   - 使用人数
   - 订阅按钮

### 样式要求
- 卡片悬浮时有光晕效果
- 渐变边框
- 专业的数据排版
- 流畅过渡动画

只输出 React 组件代码。
`;

  try {
    const chat = await v0.chats.create({
      message: prompt,
      system: '你是一个专业的金融产品设计师，擅长创建高端、专业的量化交易策略展示界面。',
    });

    console.log(`✅ 策略卡片生成成功: ${chat.webUrl}`);
    return chat;
  } catch (error) {
    console.error('❌ 生成失败:', error);
    throw error;
  }
}

// 主函数
async function main() {
  console.log('🚀 开始使用 v0 API 生成高保真 UI 组件...\n');

  // 设置环境变量
  process.env.V0_API_KEY = API_TOKEN;

  try {
    // 依次生成各个组件
    const results = await Promise.all([
      generateDashboardHeroCard(),
      generateTradingConsole(),
      generateStrategyCard(),
    ]);

    console.log('\n✅ 所有组件生成完成！');
    console.log('\n📝 生成结果:');
    results.forEach((result, index) => {
      console.log(`  ${index + 1}. ${result.webUrl}`);
    });

  } catch (error) {
    console.error('❌ 生成过程出错:', error);
  }
}

main();
