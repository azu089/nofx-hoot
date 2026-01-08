# QuantFi v1.15.0 Release Notes

> **发布日期**: 2025-12-30
> **Git Tag**: `v1.15.0`
> **Git Commit**: `04ad971`
> **状态**: ✅ Phase 15 完成，准备进入 Phase 11 实盘灰度测试

---

## 🎯 版本概述

Phase 15 "V2 懂行用户体验升级" 全部完成，通过 K线买卖点可视化、高级参数滑块、交易信号卡片和专业回测报表，兼顾"小白友好"与"懂行用户掌控感"。

**核心理念**: 渐进式披露（Progressive Disclosure）
**产品定位**: 外表是小白的傻瓜相机，内核是摄影师的单反

---

## ✨ 新增功能

### P0: K线买卖点可视化 ✅

**组件位置**: `apps/web/src/components/features/trading/TradingKLineView.tsx`

- ✅ 集成 TradingView Lightweight Charts 4.x
- ✅ 支持 6 个时间周期: 1m/5m/15m/1h/4h/1d
- ✅ 绿色▲买入标记，红色▼卖出标记
- ✅ 成交量柱状图（可选）
- ✅ 集成到交易控制台 `/trading` 页面

**价值**: 用户一眼看懂策略在何时买卖，建立专业信任感

### P1: 高级参数滑块面板 ✅

**组件位置**: `apps/web/src/components/features/strategies/AdvancedSettings.tsx`

- ✅ 止盈目标滑块: 10% ↔ 50%
- ✅ 最大持仓数滑块: 3 ↔ 10
- ✅ 入场激进程度下拉: 保守/标准/激进
- ✅ 止损线滑块: -3% ↔ -10%
- ✅ 保存/重置按钮

**价值**: 让用户感觉"我在掌控"，而不是"开盲盒"

### P2: 交易信号卡片 ✅

**组件位置**: `apps/web/src/components/features/trading/SignalCard.tsx`

- ✅ 支持买入/卖出/平仓/警报四种类型
- ✅ 信号强度标签: 强/中/弱
- ✅ 状态标签: 活跃/已触发/已过期/已取消
- ✅ 目标价/止损价/止盈价展示
- ✅ 技术指标详情（可展开）
- ✅ 创建 `SignalList` 列表组件
- ✅ 创建 `SignalSummary` 摘要组件

**价值**: 把代码日志翻译成"人话信号卡片"，提升专业感

### P3: 回测报表升级 ✅

**页面位置**: `apps/web/src/app/(dashboard)/trading/backtest/page.tsx`

- ✅ 夏普比率 (Sharpe Ratio) - 大字展示
- ✅ 最大回撤 (Max Drawdown) - 红色醒目字体
- ✅ 胜率饼图 (Recharts PieChart)
- ✅ 盈亏比 (Profit Factor)
- ✅ 风险评级系统:
  - A 级（绿色）: 夏普比率 ≥ 2.0 - 优秀
  - B 级（蓝色）: 夏普比率 ≥ 1.5 - 良好
  - C 级（黄色）: 夏普比率 ≥ 1.0 - 一般
  - D 级（红色）: 夏普比率 < 1.0 - 较差

**价值**: 用专业指标征服"懂王"用户

---

## 🔧 技术改进

- ✅ 修复 charts/index.ts 导出问题
- ✅ TypeScript 编译通过（0 errors）
- ✅ pnpm build 成功
- ✅ 前端服务运行正常（3001 端口）

---

## 📦 技术选型

| 组件 | 选型 | 版本 |
|------|------|------|
| K 线图库 | lightweight-charts | 4.x |
| 图表标注 | Markers API | - |
| 饼图 | recharts | 2.x |

---

## 📊 开发进度

| Phase | 状态 | 完成率 |
|-------|------|--------|
| Phase 1-10 | ✅ 完成 | 100% |
| Phase 9.1-9.2 AI | ✅ 完成 | 100% |
| **Phase 15 V2** | **✅ 完成** | **100%** |
| Phase 11 实盘灰度 | ⏳ 下一步 | 0% |

---

## 🎯 下一步计划

### Phase 11: 实盘灰度测试

**目标**: 在不开发新功能的前提下，验证"资金链路"和"服务器稳定性"

#### 11.1 单兵作战 (Self-Test)
- [ ] 创始人实盘充值 100 USDT
- [ ] 充值到账验证
- [ ] 启动 VPS (DigitalOcean 扣费正常)
- [ ] 策略开单 (币安同步正常)
- [ ] 盈利抽成 (数据库扣积分)
- [ ] 提现 (资金回笼)

**产出**: 资金对账单，确保 0 资损

#### 11.2 小范围灰度 (Alpha Test)
- [ ] 邀请 5 位核心用户（亲友），每人充值 50 USDT
- [ ] 高并发启动时的 DO API 配额限制测试
- [ ] 多用户环境下的计费准确性验证
- [ ] 用户反馈收集表单

**产出**: 压力测试报告，调整 DO 配额

#### 11.3 财务模型审计
- [ ] VPS 成本分析 ($5/月 DigitalOcean)
- [ ] API 调用成本 (OpenAI/币安等)
- [ ] 运维成本估算
- [ ] SaaS 订阅费定价确认 ($25/月)

**验证**: 确保 SaaS 订阅费能覆盖 VPS 成本 + API/运维成本

---

## 📝 验收方式

### 启动服务

```bash
cd /Users/azu/主QuantFi

# 启动 Docker 服务
docker compose up -d

# 启动前端服务（端口 3001）
cd apps/web && PORT=3001 pnpm dev
```

### 访问页面

- **交易控制台** - http://localhost:3001/trading
  - 查看 K 线买卖点可视化
  - 时间周期切换功能

- **回测系统** - http://localhost:3001/trading/backtest
  - 查看胜率饼图
  - 查看风险评级（A/B/C/D）

---

## 🔄 回滚方式

```bash
# 回滚到 Phase 15 之前的版本
git revert 04ad971

# 或者回退到上一个稳定版本
git checkout b524d13
```

---

## 📚 相关文档

- [开发顺序.md](文档/核心文档/开发顺序.md) - v4.2 (2025-12-30)
- [Phase15-V2体验升级实现计划.md](文档/核心文档/Phase15-V2体验升级实现计划.md)
- [UI_ARCHITECTURE.md](apps/web/src/UI_ARCHITECTURE.md) - 前端 UI 架构规范

---

## 🙏 致谢

Phase 15 开发完成，感谢 Claude Sonnet 4.5 的协助。

🤖 Generated with Claude Code
Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
