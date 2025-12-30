# QuantFi 运维手册

> 版本: v1.0 | 更新日期: 2025-12-26
> 本文档适用于 QuantFi 生产环境的日常运维操作

---

## 目录

1. [系统架构](#1-系统架构)
2. [服务管理](#2-服务管理)
3. [监控告警](#3-监控告警)
4. [数据库运维](#4-数据库运维)
5. [日志管理](#5-日志管理)
6. [故障处理](#6-故障处理)
7. [安全运维](#7-安全运维)
8. [定期维护](#8-定期维护)

---

## 1. 系统架构

### 1.1 服务组件

| 服务 | 端口 | 说明 |
|------|------|------|
| PostgreSQL | 5433 | 主数据库 |
| Redis | 6379 | 缓存/队列 |
| API (NestJS) | 4001 | 后端 API |
| Web (Next.js) | 3001 | 前端应用 |
| Nginx | 80/443 | 反向代理 |

### 1.2 目录结构

```
/opt/quantfi/              # 生产环境根目录
├── apps/                  # 应用代码
├── backups/               # 数据库备份
├── logs/                  # 应用日志
├── nginx/                 # Nginx 配置
├── scripts/               # 运维脚本
└── docker-compose.prod.yml
```

### 1.3 网络架构

```
外部请求 → Nginx (80/443) → API (4001) / Web (3001)
                              ↓
                         PostgreSQL (5433)
                              ↓
                          Redis (6379)
```

---

## 2. 服务管理

### 2.1 启动服务

```bash
# 启动所有服务
cd /opt/quantfi
docker compose -f docker-compose.prod.yml up -d

# 验证服务状态
docker compose -f docker-compose.prod.yml ps
```

### 2.2 停止服务

```bash
# 优雅停止所有服务
docker compose -f docker-compose.prod.yml down

# 强制停止（紧急情况）
docker compose -f docker-compose.prod.yml down --timeout 10
```

### 2.3 重启单个服务

```bash
# 重启 API 服务
docker compose -f docker-compose.prod.yml restart api

# 重启 Web 服务
docker compose -f docker-compose.prod.yml restart web

# 重启数据库（谨慎操作）
docker compose -f docker-compose.prod.yml restart postgres
```

### 2.4 查看服务日志

```bash
# 查看 API 日志
docker compose -f docker-compose.prod.yml logs -f api

# 查看最近 100 行日志
docker compose -f docker-compose.prod.yml logs --tail 100 api

# 查看所有服务日志
docker compose -f docker-compose.prod.yml logs -f
```

### 2.5 滚动更新

```bash
# 拉取最新镜像
docker compose -f docker-compose.prod.yml pull

# 滚动更新（零停机）
docker compose -f docker-compose.prod.yml up -d --no-deps api
docker compose -f docker-compose.prod.yml up -d --no-deps web
```

---

## 3. 监控告警

### 3.1 运行监控脚本

```bash
# 手动运行
./scripts/运维/监控检查.sh

# 添加定时任务（每 5 分钟）
crontab -e
# 添加: */5 * * * * /opt/quantfi/scripts/运维/监控检查.sh >> /opt/quantfi/logs/monitor.log 2>&1
```

### 3.2 监控指标

| 指标 | 阈值 | 告警级别 |
|------|------|---------|
| CPU 使用率 | > 80% | 警告 |
| 内存使用率 | > 80% | 警告 |
| 磁盘使用率 | > 80% | 严重 |
| API 响应时间 | > 2s | 警告 |
| 数据库连接数 | > 90% | 严重 |

### 3.3 健康检查端点

```bash
# API 健康检查
curl http://localhost:4001/api/health

# 预期响应
{
  "code": 0,
  "data": {
    "status": "ok",
    "database": "connected",
    "redis": "connected"
  }
}
```

### 3.4 告警配置

配置 Slack 告警：

```bash
# 设置环境变量
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/xxx/xxx/xxx"
export ALERT_EMAIL="ops@quantfi.io"
```

---

## 4. 数据库运维

### 4.1 备份策略

| 备份类型 | 频率 | 保留周期 | 存储位置 |
|---------|------|---------|---------|
| 全量备份 | 每日 03:00 | 7 天 | 本地 + S3 |
| 增量备份 | 每小时 | 24 小时 | 本地 |
| 事务日志 | 实时 | 7 天 | S3 |

### 4.2 手动备份

```bash
# 执行全量备份
./scripts/运维/数据库备份.sh

# 备份文件位置
ls -la /opt/quantfi/backups/
```

### 4.3 恢复数据库

```bash
# 从备份恢复
./scripts/运维/数据库恢复.sh /opt/quantfi/backups/quantfi_20251226_030000.sql.gz

# 验证恢复
docker exec quantfi-postgres-prod psql -U quantfi -d quantfi -c "SELECT count(*) FROM users;"
```

### 4.4 定时备份任务

```bash
# 添加定时任务
crontab -e

# 每日 03:00 执行备份
0 3 * * * /opt/quantfi/scripts/运维/数据库备份.sh >> /opt/quantfi/logs/backup.log 2>&1
```

### 4.5 数据库连接

```bash
# 连接数据库
docker exec -it quantfi-postgres-prod psql -U quantfi -d quantfi

# 常用 SQL
\dt                           # 查看所有表
\d users                      # 查看表结构
SELECT count(*) FROM users;   # 统计用户数
```

### 4.6 数据库性能优化

```sql
-- 查看慢查询
SELECT pid, now() - pg_stat_activity.query_start AS duration, query
FROM pg_stat_activity
WHERE (now() - pg_stat_activity.query_start) > interval '5 seconds';

-- 查看连接数
SELECT count(*) FROM pg_stat_activity;

-- 查看表大小
SELECT relname, pg_size_pretty(pg_total_relation_size(relid))
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC;
```

---

## 5. 日志管理

### 5.1 日志位置

| 日志类型 | 位置 |
|---------|------|
| API 日志 | `docker logs quantfi-api-prod` |
| Web 日志 | `docker logs quantfi-web-prod` |
| Nginx 日志 | `/opt/quantfi/logs/nginx/` |
| PostgreSQL 日志 | `docker logs quantfi-postgres-prod` |

### 5.2 日志轮转

Nginx 日志轮转配置 `/etc/logrotate.d/quantfi`：

```
/opt/quantfi/logs/nginx/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data adm
    sharedscripts
    postrotate
        docker exec quantfi-nginx nginx -s reload
    endscript
}
```

### 5.3 日志搜索

```bash
# 搜索错误日志
docker logs quantfi-api-prod 2>&1 | grep -i error

# 按时间范围搜索
docker logs quantfi-api-prod --since "2025-12-26T00:00:00" --until "2025-12-26T12:00:00"

# 搜索特定请求
docker logs quantfi-api-prod 2>&1 | grep "request_id: abc123"
```

---

## 6. 故障处理

### 6.1 常见问题排查

#### 服务无响应

```bash
# 1. 检查服务状态
docker compose -f docker-compose.prod.yml ps

# 2. 检查资源使用
docker stats

# 3. 检查日志
docker logs quantfi-api-prod --tail 100

# 4. 重启服务
docker compose -f docker-compose.prod.yml restart api
```

#### 数据库连接失败

```bash
# 1. 检查数据库状态
docker exec quantfi-postgres-prod pg_isready -U quantfi

# 2. 检查连接数
docker exec quantfi-postgres-prod psql -U quantfi -c "SELECT count(*) FROM pg_stat_activity;"

# 3. 重启数据库
docker compose -f docker-compose.prod.yml restart postgres

# 4. 等待数据库就绪后重启 API
sleep 10
docker compose -f docker-compose.prod.yml restart api
```

#### 磁盘空间不足

```bash
# 1. 检查磁盘使用
df -h

# 2. 清理 Docker 资源
docker system prune -a --volumes

# 3. 清理旧日志
find /opt/quantfi/logs -name "*.log" -mtime +7 -delete

# 4. 清理旧备份
find /opt/quantfi/backups -name "*.sql.gz" -mtime +7 -delete
```

#### 内存不足

```bash
# 1. 检查内存使用
free -h

# 2. 检查容器内存
docker stats --no-stream

# 3. 重启内存占用高的服务
docker compose -f docker-compose.prod.yml restart api web
```

### 6.2 紧急回滚

```bash
# 1. 停止当前服务
docker compose -f docker-compose.prod.yml down

# 2. 回滚到上一个版本
docker compose -f docker-compose.prod.yml pull ghcr.io/quantfi/api:previous
docker compose -f docker-compose.prod.yml pull ghcr.io/quantfi/web:previous

# 3. 启动回滚版本
docker compose -f docker-compose.prod.yml up -d
```

### 6.3 Kill Switch（紧急停机）

```bash
# 紧急停止所有交易相关服务
docker compose -f docker-compose.prod.yml stop api

# 广播停机通知
curl -X POST http://localhost:4001/api/admin/broadcast \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "系统紧急维护中，请稍后再试"}'
```

---

## 7. 安全运维

### 7.1 SSL 证书管理

```bash
# 查看证书到期时间
openssl x509 -in /etc/letsencrypt/live/quantfi.io/fullchain.pem -noout -dates

# 手动续期
certbot renew --dry-run  # 测试
certbot renew            # 正式续期

# 自动续期（添加定时任务）
0 0 1 * * certbot renew --quiet && docker exec quantfi-nginx nginx -s reload
```

### 7.2 防火墙配置

```bash
# UFW 规则
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw deny 5433/tcp   # 禁止外部访问 PostgreSQL
ufw deny 6379/tcp   # 禁止外部访问 Redis
ufw enable
```

### 7.3 安全审计

```bash
# 检查登录失败记录
grep "Failed password" /var/log/auth.log | tail -20

# 检查可疑进程
ps aux | grep -v "^\[" | sort -k3 -r | head -20

# 检查开放端口
netstat -tlnp
```

### 7.4 敏感信息管理

- 所有敏感信息通过环境变量注入
- 生产环境禁止在日志中打印密钥
- 定期轮换 API Key 和数据库密码

---

## 8. 定期维护

### 8.1 日常检查清单

| 时间 | 任务 | 命令 |
|------|------|------|
| 每日 | 检查服务状态 | `docker compose ps` |
| 每日 | 检查磁盘空间 | `df -h` |
| 每日 | 检查备份状态 | `ls -la /opt/quantfi/backups/` |
| 每周 | 检查 SSL 证书 | `openssl x509 -enddate` |
| 每周 | 清理 Docker 资源 | `docker system prune` |
| 每月 | 更新系统 | `apt update && apt upgrade` |

### 8.2 自动维护脚本

```bash
#!/bin/bash
# /opt/quantfi/scripts/运维/日常维护.sh

echo "=== $(date) 开始日常维护 ==="

# 1. 健康检查
./scripts/运维/监控检查.sh

# 2. 清理旧日志
find /opt/quantfi/logs -name "*.log" -mtime +7 -delete

# 3. 清理 Docker 资源
docker system prune -f

# 4. 检查备份
BACKUP_COUNT=$(ls /opt/quantfi/backups/*.sql.gz 2>/dev/null | wc -l)
if [ $BACKUP_COUNT -lt 7 ]; then
  echo "[WARN] 备份文件不足 7 个"
fi

echo "=== $(date) 日常维护完成 ==="
```

### 8.3 维护窗口

- **常规维护**: 每周日 03:00-05:00 UTC
- **紧急维护**: 随时，需提前 15 分钟通知
- **大版本更新**: 每月第一个周日 03:00-06:00 UTC

---

## 附录

### A. 常用命令速查

```bash
# 服务管理
docker compose -f docker-compose.prod.yml up -d     # 启动
docker compose -f docker-compose.prod.yml down      # 停止
docker compose -f docker-compose.prod.yml restart   # 重启
docker compose -f docker-compose.prod.yml logs -f   # 日志

# 数据库
./scripts/运维/数据库备份.sh                         # 备份
./scripts/运维/数据库恢复.sh <备份文件>              # 恢复

# 监控
./scripts/运维/监控检查.sh                           # 监控
curl http://localhost:4001/api/health               # 健康检查
```

### B. 联系方式

| 角色 | 联系方式 |
|------|---------|
| 运维负责人 | ops@quantfi.io |
| 开发负责人 | dev@quantfi.io |
| 紧急热线 | +86-xxx-xxxx-xxxx |

### C. 变更记录

| 日期 | 版本 | 变更 |
|------|------|------|
| 2025-12-26 | v1.0 | 初始版本 |

---

**重要提示**: 本文档需要定期审查和更新，确保与实际生产环境保持一致。
