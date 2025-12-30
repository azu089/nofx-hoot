# 回测系统页面

## 页面路径
`/trading/backtest`

## 功能说明

### 左侧配置面板
1. 策略选择下拉框 - 从策略列表 API 获取
2. 起始日期选择器
3. 结束日期选择器
4. 初始资金输入框
5. 交易对多选按钮组（8个主流交易对）
6. 开始回测按钮

### 右侧结果展示

#### 加载状态
- 显示 Spinner 动画
- 提示文字："正在回测中，请稍候..."

#### 空状态
- 显示 BarChart3 图标
- 提示用户配置参数

#### 回测结果
1. **核心指标卡片（4个）**
   - 总收益率
   - 胜率
   - 最大回撤
   - 夏普比率

2. **收益曲线图**
   - 使用 Recharts AreaChart
   - 蓝色渐变填充
   - 暗黑主题样式

3. **详细统计（6个指标）**
   - 交易次数
   - 平均盈利
   - 平均亏损
   - 盈亏比
   - 初始资金
   - 最终资金

## 数据说明

目前使用**模拟数据**：
- 策略列表：3个策略（稳健防御型、趋势追踪型、激进复利型）
- 回测结果：随机生成模拟数据

待后端 API 完成后，替换为真实数据：
```typescript
// TODO: 调用真实回测 API
const response = await backtestApi.run({
  strategyId,
  startDate,
  endDate,
  initialCapital,
  pairs: selectedPairs
});
```

## 依赖组件
- Card, CardHeader, CardTitle, CardContent (UI)
- Button (UI)
- Select (UI) - 新创建
- Input (UI)
- Recharts (AreaChart)

## 样式
- 暗黑主题
- 华尔街风格配色
- 两栏响应式布局（移动端单列）
