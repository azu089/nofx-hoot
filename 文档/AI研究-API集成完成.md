# AI 研究页面 - API 集成完成

**日期**: 2026-02-14
**状态**: ✅ 完成

---

## 改动摘要

将 AI 研究入口页和详情页的 mock 数据替换为真实 API 调用。

---

## 修改的文件

### 1. `/apps/web/src/components/ui-v3/mobile/ai-research-entry.tsx`

**改动内容**:
- 移除 `mockHistory` 数组和 `HistoryItem` 类型
- 添加 `useResearchHistory` 和 `useStartResearch` hooks
- 添加 `useRouter` 用于导航
- 添加 `formatTimeAgo` 辅助函数格式化时间
- 实现 `handleStartResearch` 启动研究并导航到详情页
- 历史列表从 API 数据渲染，支持点击跳转
- 显示加载状态和空状态

**关键逻辑**:
```typescript
const handleStartResearch = async () => {
  const result = await startResearch.mutateAsync({
    symbol: selectedSymbol,
    depth,
    autoExecute,
  });
  router.push(`/ai-research/${result.sessionId}`);
};
```

**数据映射**:
- `item.status === 'completed'` → success
- `item.status === 'failed'` → failed
- `item.decision?.action` → BUY/SELL/HOLD
- `item.decision?.confidence` → 置信度
- `item.createdAt` → 格式化为相对时间

---

### 2. `/apps/web/src/components/ui-v3/mobile/ai-research-detail.tsx`

**改动内容**:
- 移除 mock 数据和 `status` 本地状态
- 添加 `useParams` 获取 sessionId
- 添加 `useResearchStatus`, `useResearchReport`, `useExecuteResearch` hooks
- 从 API 数据构建 stages 和 decisionData
- 实现 `handleExecute` 执行交易
- 自动轮询 status（running 时每 3 秒刷新）
- 显示加载状态

**关键逻辑**:
```typescript
const { data: statusData } = useResearchStatus(sessionId);
const { data: reportData } = useResearchReport(
  sessionId,
  statusData?.status === 'completed' || statusData?.status === 'failed'
);

const status = statusData?.status || 'running';
```

**数据映射**:
- `reportData.stages[]` → 阶段列表
- `reportData.finalDecision` → 决策数据
- `reportData.finalDecision.action` → long/short 方向
- `reportData.finalDecision.confidence` → 置信度
- `reportData.finalDecision.reasoning` → 分析报告内容
- `reportData.executedTradeId` → 是否已执行

**执行按钮显示条件**:
- `status === 'completed'`
- `decisionData` 存在
- `!reportData?.executedTradeId` (未执行)
- `action !== 'hold' && action !== 'wait'` (非观望)

---

## 验证步骤

### 1. 启动开发服务器
```bash
cd apps/web
pnpm dev
```

### 2. 访问 AI 研究入口页
```
http://localhost:3001/ai-research
```

**预期行为**:
- 显示真实的研究历史列表（从 `/ai/research/history` 获取）
- 点击"开始研究"按钮发起请求，成功后跳转到详情页
- 历史列表可点击，跳转到对应详情页

### 3. 访问 AI 研究详情页
```
http://localhost:3001/ai-research/{sessionId}
```

**预期行为**:
- `running` 状态：显示进度条，3 秒轮询更新
- `completed` 状态：显示决策卡片和执行按钮
- 点击"执行交易"按钮调用 API 并显示结果

---

## API 端点依赖

| 端点 | 方法 | 用途 |
|------|------|------|
| `/ai/research/start` | POST | 启动研究 |
| `/ai/research/history` | GET | 历史列表 |
| `/ai/research/{sessionId}/status` | GET | 状态轮询 |
| `/ai/research/{sessionId}/report` | GET | 研究报告 |
| `/ai/research/{sessionId}/execute` | POST | 执行交易 |

---

## 类型安全

所有 API 调用均使用 `/types/ai.ts` 中定义的类型，确保前后端数据结构一致。

---

## 风险与注意事项

1. **sessionId 不存在**: 如果 URL 中的 sessionId 无效，会显示加载状态
2. **轮询性能**: running 状态每 3 秒轮询一次，completed/failed 停止轮询
3. **执行确认**: 执行交易前有确认弹窗，防止误操作

---

## 回滚方案

如需回滚，恢复以下 commit:
```bash
git revert HEAD
```

或手动恢复 mock 数据逻辑。

---

## 下一步

- [ ] 添加错误边界处理
- [ ] 优化加载动画
- [ ] 添加 Toast 通知替代 alert
- [ ] 支持取消正在进行的研究

---

**验收**: ✅ 编译通过，无 TypeScript 错误
