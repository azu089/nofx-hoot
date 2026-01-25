#!/bin/bash
# ====================================
# QuantFi 服务启动脚本
# ====================================
# 在代码上传后运行此脚本

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

cd /opt/quantfi

echo -e "${GREEN}=====================================${NC}"
echo -e "${GREEN}   QuantFi 服务启动脚本${NC}"
echo -e "${GREEN}=====================================${NC}"
echo ""

# ------------------------------------
# 第一步：启动数据库和 Redis
# ------------------------------------
echo -e "${YELLOW}[1/6] 启动 PostgreSQL 和 Redis...${NC}"

docker compose up -d
sleep 10

# 检查服务状态
docker compose ps

# ------------------------------------
# 第二步：安装依赖
# ------------------------------------
echo -e "${YELLOW}[2/6] 安装项目依赖...${NC}"

pnpm install

# ------------------------------------
# 第三步：复制生产配置
# ------------------------------------
echo -e "${YELLOW}[3/6] 配置环境变量...${NC}"

# 后端配置
cp apps/api/.env.production apps/api/.env

# 前端配置
cp apps/web/.env.production apps/web/.env.local

# ------------------------------------
# 第四步：数据库迁移
# ------------------------------------
echo -e "${YELLOW}[4/6] 执行数据库迁移...${NC}"

cd apps/api
npx prisma migrate deploy
npx prisma generate
cd ../..

# ------------------------------------
# 第五步：构建项目
# ------------------------------------
echo -e "${YELLOW}[5/6] 构建项目...${NC}"

pnpm build

# ------------------------------------
# 第六步：使用 PM2 启动服务
# ------------------------------------
echo -e "${YELLOW}[6/6] 启动应用服务...${NC}"

# 停止已有服务（如果存在）
pm2 delete all 2>/dev/null || true

# 启动后端
cd apps/api
pm2 start dist/main.js --name quantfi-api
cd ../..

# 启动前端
cd apps/web
pm2 start npm --name quantfi-web -- start
cd ../..

# 保存 PM2 配置
pm2 save
pm2 startup | tail -1 | bash 2>/dev/null || true

echo ""
echo -e "${GREEN}=====================================${NC}"
echo -e "${GREEN}   服务启动完成！${NC}"
echo -e "${GREEN}=====================================${NC}"
echo ""

# 显示服务状态
pm2 status

echo ""
echo -e "验证服务："
echo -e "  后端: curl http://localhost:4001/api/health"
echo -e "  前端: curl http://localhost:3001"
echo ""
echo -e "${YELLOW}下一步: 配置 SSL 证书${NC}"
echo -e "运行: sudo certbot --nginx -d tizo.cc -d www.tizo.cc -d api.tizo.cc"
echo ""
