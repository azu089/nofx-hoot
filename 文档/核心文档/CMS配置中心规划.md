# CMS + 配置中心模块规划

> 版本: v1.0 | 创建日期: 2025-12-29
> 目标: 实现全维度后台管理，支持动态文案、配置、内容管理

---

## 一、功能清单

### 1.1 内容管理 (CMS)

| 功能 | 说明 | 优先级 |
|------|------|--------|
| **页面文案管理** | 首页、登录页、各功能页的文案 | P0 |
| **Banner 管理** | 首页轮播图、活动 Banner | P0 |
| **公告管理** | 系统公告、弹窗通知（已有，增强） | P1 |
| **帮助文档** | FAQ、使用教程 | P1 |
| **富文本编辑** | 支持图片、链接、格式 | P1 |

### 1.2 配置中心

| 功能 | 说明 | 优先级 |
|------|------|--------|
| **费率配置** | Gas Fee 比例、提现手续费 | P0 |
| **VIP 价格配置** | 各等级价格、权益 | P0 |
| **功能开关** | 注册开关、提现开关、交易开关 | P0 |
| **VPS 配置** | 各规格价格、区域配置 | P1 |
| **积分规则** | 签到积分、任务积分 | P1 |
| **代理商规则** | 返佣比例、提现门槛 | P1 |

### 1.3 运营工具

| 功能 | 说明 | 优先级 |
|------|------|--------|
| **邮件模板** | 注册、重置密码、通知邮件 | P2 |
| **推送管理** | 站内信、推送通知 | P2 |
| **SEO 管理** | 页面标题、描述、关键词 | P2 |

---

## 二、数据库设计

### 2.1 系统配置表 `system_configs`

```sql
CREATE TABLE system_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key VARCHAR(100) UNIQUE NOT NULL,     -- 配置键
  config_value JSONB NOT NULL,                  -- 配置值 (JSON 格式)
  config_type VARCHAR(50) NOT NULL,             -- 类型: string/number/boolean/json
  category VARCHAR(50) NOT NULL,                -- 分类: billing/vip/feature/vps/agent
  label VARCHAR(100) NOT NULL,                  -- 显示名称
  description TEXT,                             -- 说明
  is_public BOOLEAN DEFAULT false,              -- 是否公开给前端
  updated_by UUID REFERENCES users(id),         -- 更新人
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_system_configs_category ON system_configs(category);
CREATE INDEX idx_system_configs_is_public ON system_configs(is_public);
```

### 2.2 CMS 内容表 `cms_contents`

```sql
CREATE TABLE cms_contents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_key VARCHAR(100) UNIQUE NOT NULL,    -- 内容键 (如 landing.hero.title)
  content_type VARCHAR(50) NOT NULL,            -- 类型: text/richtext/image/json
  title VARCHAR(200),                           -- 标题
  content TEXT NOT NULL,                        -- 内容
  locale VARCHAR(10) DEFAULT 'zh-CN',           -- 语言
  is_published BOOLEAN DEFAULT true,            -- 是否发布
  publish_at TIMESTAMPTZ,                       -- 定时发布
  expire_at TIMESTAMPTZ,                        -- 过期时间
  sort_order INT DEFAULT 0,                     -- 排序
  metadata JSONB,                               -- 元数据
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_cms_contents_key ON cms_contents(content_key);
CREATE INDEX idx_cms_contents_type ON cms_contents(content_type);
CREATE INDEX idx_cms_contents_published ON cms_contents(is_published);
```

### 2.3 Banner 表 `cms_banners`

```sql
CREATE TABLE cms_banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  position VARCHAR(50) NOT NULL,               -- 位置: home_hero/home_promo/login_side
  title VARCHAR(200) NOT NULL,
  subtitle VARCHAR(500),
  image_url VARCHAR(500) NOT NULL,
  link_url VARCHAR(500),
  link_target VARCHAR(20) DEFAULT '_self',     -- _self/_blank
  button_text VARCHAR(50),
  is_active BOOLEAN DEFAULT true,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  sort_order INT DEFAULT 0,
  click_count INT DEFAULT 0,
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_cms_banners_position ON cms_banners(position);
CREATE INDEX idx_cms_banners_active ON cms_banners(is_active);
```

### 2.4 帮助文档表 `cms_help_docs`

```sql
CREATE TABLE cms_help_docs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category VARCHAR(50) NOT NULL,               -- 分类: faq/tutorial/guide
  title VARCHAR(200) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,           -- URL 友好的标识
  summary TEXT,                                 -- 摘要
  content TEXT NOT NULL,                        -- 富文本内容
  tags VARCHAR(200)[],                          -- 标签
  view_count INT DEFAULT 0,
  is_published BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_cms_help_docs_category ON cms_help_docs(category);
CREATE INDEX idx_cms_help_docs_slug ON cms_help_docs(slug);
```

---

## 三、API 设计

### 3.1 配置中心 API

```
GET    /api/configs/public              # 获取公开配置（前端用）
GET    /api/admin/configs               # 获取所有配置（管理端）
GET    /api/admin/configs/:key          # 获取单个配置
PUT    /api/admin/configs/:key          # 更新配置
POST   /api/admin/configs/batch         # 批量更新配置
```

### 3.2 CMS API

```
# 公开接口（前端用）
GET    /api/cms/contents/:key           # 获取单个内容
GET    /api/cms/banners/:position       # 获取指定位置 Banner
GET    /api/cms/help/:slug              # 获取帮助文档

# 管理接口
GET    /api/admin/cms/contents          # 内容列表
POST   /api/admin/cms/contents          # 创建内容
PUT    /api/admin/cms/contents/:id      # 更新内容
DELETE /api/admin/cms/contents/:id      # 删除内容

GET    /api/admin/cms/banners           # Banner 列表
POST   /api/admin/cms/banners           # 创建 Banner
PUT    /api/admin/cms/banners/:id       # 更新 Banner
DELETE /api/admin/cms/banners/:id       # 删除 Banner

GET    /api/admin/cms/help-docs         # 帮助文档列表
POST   /api/admin/cms/help-docs         # 创建文档
PUT    /api/admin/cms/help-docs/:id     # 更新文档
DELETE /api/admin/cms/help-docs/:id     # 删除文档
```

---

## 四、初始配置数据

### 4.1 计费配置

```json
{
  "billing.gas_fee_rate": { "value": 0.20, "label": "燃油费比例", "type": "number" },
  "billing.withdraw_fee_rate": { "value": 0.01, "label": "提现手续费", "type": "number" },
  "billing.min_withdraw": { "value": 10, "label": "最低提现金额", "type": "number" },
  "billing.points_to_usdt": { "value": 1, "label": "积分兑换比例", "type": "number" }
}
```

### 4.2 VIP 配置

```json
{
  "vip.level_1_price": { "value": 25, "label": "VIP1 月费", "type": "number" },
  "vip.level_2_price": { "value": 50, "label": "VIP2 月费", "type": "number" },
  "vip.level_3_price": { "value": 100, "label": "VIP3 月费", "type": "number" },
  "vip.level_1_vps_spec": { "value": "1vCPU/1GB", "label": "VIP1 VPS 规格", "type": "string" },
  "vip.level_2_vps_spec": { "value": "2vCPU/2GB", "label": "VIP2 VPS 规格", "type": "string" },
  "vip.level_3_vps_spec": { "value": "2vCPU/4GB", "label": "VIP3 VPS 规格", "type": "string" }
}
```

### 4.3 功能开关

```json
{
  "feature.registration_enabled": { "value": true, "label": "开放注册", "type": "boolean" },
  "feature.withdraw_enabled": { "value": true, "label": "允许提现", "type": "boolean" },
  "feature.trading_enabled": { "value": true, "label": "允许交易", "type": "boolean" },
  "feature.new_instance_enabled": { "value": true, "label": "允许创建实例", "type": "boolean" },
  "feature.agent_enabled": { "value": true, "label": "代理商系统", "type": "boolean" },
  "feature.staking_enabled": { "value": true, "label": "质押功能", "type": "boolean" }
}
```

### 4.4 代理商配置

```json
{
  "agent.level_1_rate": { "value": 0.10, "label": "一级返佣比例", "type": "number" },
  "agent.level_2_rate": { "value": 0.05, "label": "二级返佣比例", "type": "number" },
  "agent.min_withdraw": { "value": 50, "label": "最低提佣金额", "type": "number" }
}
```

---

## 五、管理后台页面

### 5.1 配置中心页面 `/admin/settings`

```
/admin/settings
├── /billing          # 计费配置
├── /vip              # VIP 配置
├── /features         # 功能开关
├── /vps              # VPS 配置
└── /agent            # 代理商配置
```

### 5.2 CMS 页面 `/admin/cms`

```
/admin/cms
├── /contents         # 页面文案管理
├── /banners          # Banner 管理
└── /help-docs        # 帮助文档管理
```

### 5.3 页面设计

#### 配置中心 - 功能开关

```
┌──────────────────────────────────────────────────┐
│  功能开关                                         │
├──────────────────────────────────────────────────┤
│                                                  │
│  ┌─────────────────────────────────────────────┐│
│  │ 开放注册                              [开关] ││
│  │ 允许新用户注册                               ││
│  └─────────────────────────────────────────────┘│
│                                                  │
│  ┌─────────────────────────────────────────────┐│
│  │ 允许提现                              [开关] ││
│  │ 用户可以申请提现                             ││
│  └─────────────────────────────────────────────┘│
│                                                  │
│  ┌─────────────────────────────────────────────┐│
│  │ 允许交易                              [开关] ││
│  │ 策略可以执行交易                             ││
│  └─────────────────────────────────────────────┘│
│                                                  │
└──────────────────────────────────────────────────┘
```

#### CMS - Banner 管理

```
┌──────────────────────────────────────────────────┐
│  Banner 管理                    [+ 新建 Banner]   │
├──────────────────────────────────────────────────┤
│                                                  │
│  位置筛选: [全部 ▼] [首页 Hero] [首页活动] [登录页]│
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │ [图片预览]  首页主 Banner                   │  │
│  │             副标题: 专业量化交易平台         │  │
│  │             状态: ● 已启用                  │  │
│  │             [编辑] [禁用] [删除]            │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │ [图片预览]  新年活动 Banner                 │  │
│  │             2025-01-01 ~ 2025-01-15        │  │
│  │             状态: ○ 待生效                  │  │
│  │             [编辑] [启用] [删除]            │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
└──────────────────────────────────────────────────┘
```

---

## 六、实现步骤

### Phase 1: 数据库 + 后端 (Day 1-2)

1. 创建数据库迁移文件
2. 更新 Prisma Schema
3. 创建 ConfigsModule (配置中心)
4. 创建 CmsModule (内容管理)
5. 初始化种子数据

### Phase 2: 管理后台页面 (Day 3-4)

1. 配置中心页面
   - 计费配置表单
   - VIP 配置表单
   - 功能开关页面
2. CMS 页面
   - 内容列表 + 编辑
   - Banner 管理
   - 帮助文档管理

### Phase 3: 前端集成 (Day 5)

1. 公开配置 API 调用
2. 动态内容渲染
3. Banner 组件
4. 帮助中心页面

### Phase 4: 测试 + 优化 (Day 6)

1. 功能测试
2. 缓存优化 (Redis)
3. 权限验证
4. 文档更新

---

## 七、技术要点

### 7.1 配置缓存

```typescript
// Redis 缓存配置，减少数据库查询
@Injectable()
export class ConfigsService {
  private readonly CACHE_KEY = 'system:configs';
  private readonly CACHE_TTL = 300; // 5 分钟

  async getPublicConfigs() {
    // 1. 先查缓存
    const cached = await this.redis.get(this.CACHE_KEY);
    if (cached) return JSON.parse(cached);

    // 2. 查数据库
    const configs = await this.prisma.system_configs.findMany({
      where: { is_public: true }
    });

    // 3. 写缓存
    await this.redis.setex(this.CACHE_KEY, this.CACHE_TTL, JSON.stringify(configs));
    return configs;
  }

  async updateConfig(key: string, value: any) {
    // 更新数据库
    await this.prisma.system_configs.update(...);
    // 清除缓存
    await this.redis.del(this.CACHE_KEY);
  }
}
```

### 7.2 前端配置 Hook

```typescript
// hooks/useConfig.ts
export function useConfig(key: string, defaultValue?: any) {
  const { data } = useQuery({
    queryKey: ['configs', 'public'],
    queryFn: () => api.get('/configs/public'),
    staleTime: 5 * 60 * 1000, // 5 分钟
  });

  return data?.configs?.[key] ?? defaultValue;
}

// 使用
const gasFeeRate = useConfig('billing.gas_fee_rate', 0.2);
const isWithdrawEnabled = useConfig('feature.withdraw_enabled', true);
```

### 7.3 富文本编辑器

推荐使用 **TipTap** (基于 ProseMirror)：
- 模块化、可扩展
- TypeScript 支持
- 与 React 集成良好

---

## 版本记录

| 版本 | 日期 | 变更 |
|------|------|------|
| v1.0 | 2025-12-29 | 初始规划 |
