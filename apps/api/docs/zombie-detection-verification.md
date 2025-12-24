# 僵尸节点检测功能验收文档

## 功能说明

定时任务每 5 分钟检测一次僵尸节点（15 分钟无心跳的实例），并自动标记为 `zombie` 状态。

## 验收步骤

### 1. 启动服务

```bash
cd /Users/azu/主QuantFi/apps/api
PORT=4001 pnpm dev
```

**预期结果**：
- 看到 `ScheduleModule dependencies initialized` 日志
- 服务成功启动在端口 4001

### 2. 检查健康接口

```bash
curl http://localhost:4001/api/health
```

**预期结果**：
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "status": "healthy",
    ...
  }
}
```

### 3. 查看定时任务注册

```bash
# 检查日志中是否有 ScheduleModule 初始化
grep "ScheduleModule" logs/api.log
```

**预期结果**：
- 看到 `ScheduleModule dependencies initialized` 日志

### 4. 验证僵尸节点检测逻辑

#### 方法 A：直接查询数据库

```bash
docker exec -i quantfi-postgres psql -U quantfi -d quantfi -c "
SELECT
  id,
  user_id,
  status,
  last_heartbeat,
  EXTRACT(EPOCH FROM (NOW() - last_heartbeat))/60 as minutes_since_heartbeat,
  destroy_reason
FROM instances
WHERE status IN ('running', 'zombie')
ORDER BY created_at DESC
LIMIT 10;
"
```

**预期结果**：
- `zombie` 状态的实例，`minutes_since_heartbeat` > 15
- `destroy_reason` = '心跳超时（15分钟无响应）'

#### 方法 B：创建测试数据

```sql
-- 1. 创建一个测试实例
INSERT INTO instances (
  id,
  user_id,
  region,
  size,
  status,
  last_heartbeat
) VALUES (
  gen_random_uuid(),
  (SELECT id FROM users LIMIT 1),
  'sgp1',
  's-1vcpu-1gb',
  'running',
  NOW() - INTERVAL '20 minutes'  -- 20 分钟前
);

-- 2. 等待定时任务执行（最多 5 分钟）

-- 3. 查询该实例状态
SELECT id, status, destroy_reason
FROM instances
WHERE last_heartbeat < NOW() - INTERVAL '15 minutes'
  AND status = 'zombie';
```

**预期结果**：
- 20 分钟无心跳的实例被标记为 `zombie`
- `destroy_reason` = '心跳超时（15分钟无响应）'

### 5. 查看定时任务执行日志

定时任务会输出以下日志：

- **正常情况（无僵尸节点）**：
  ```
  [ZombieDetectionTask] 开始执行僵尸节点检测任务
  [ZombieDetectionTask] 未发现僵尸节点
  ```

- **发现僵尸节点**：
  ```
  [ZombieDetectionTask] 开始执行僵尸节点检测任务
  [ZombieDetectionTask] 发现 2 个僵尸节点，开始标记
  [InstancesService] [僵尸节点告警] 实例 xxx 标记为僵尸节点，用户 yyy，最后心跳: ...
  [ZombieDetectionTask] 僵尸节点检测完成: 成功标记 2 个，失败 0 个
  ```

## 回滚方案

如果需要回滚此功能：

1. 停止服务
2. 修改代码：
   ```bash
   # 从 app.module.ts 移除 ScheduleModule
   # 从 instances.module.ts 移除 ZombieDetectionTask
   ```
3. 重启服务

或者使用 git：

```bash
git revert <commit-hash>
```

## 定时任务配置

- **执行频率**：每 5 分钟（`EVERY_5_MINUTES`）
- **心跳超时阈值**：15 分钟
- **任务名称**：`zombie-detection`

## 修改执行频率

编辑 `src/modules/instances/tasks/zombie-detection.task.ts`：

```typescript
// 改为每 10 分钟执行
@Cron(CronExpression.EVERY_10_MINUTES, {
  name: 'zombie-detection',
})

// 或自定义 cron 表达式（每 3 分钟）
@Cron('*/3 * * * *', {
  name: 'zombie-detection',
})
```

## 文件清单

| 文件 | 说明 |
|------|------|
| `apps/api/src/app.module.ts` | 导入 ScheduleModule.forRoot() |
| `apps/api/src/modules/instances/instances.module.ts` | 注册 ZombieDetectionTask |
| `apps/api/src/modules/instances/tasks/zombie-detection.task.ts` | 定时任务实现 |
| `apps/api/src/modules/instances/instances.service.ts` | 新增 markAsZombie() 方法 |

## 风险说明

- **低风险**：只做状态标记，不执行销毁操作
- **可回滚**：可以通过 SQL 手动恢复状态
- **幂等性**：多次标记同一实例不会产生副作用
