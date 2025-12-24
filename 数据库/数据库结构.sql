-- ============================================================================
-- QuantFi Platform Database Schema
-- Version: 1.0.0
-- Based on: QUANTFI_ULTIMATE_WHITE_PAPER v4.0
-- ============================================================================
-- 核心设计原则：
--   1. 单租户隔离：每个 VIP 用户对应独立 VPS
--   2. AES-256-GCM 加密：API Key 使用 encrypted_blob + iv 存储
--   3. 双轨质押：Type A (空投/积分) / Type B (本金购买)
--   4. 幂等计费：billing_logs 使用 unique_order_id 唯一约束
--   5. 资金字段统一使用 DECIMAL(18,8)，禁止 FLOAT
-- ============================================================================

-- 启用 UUID 扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 模块 1: Identity (身份认证模块)
-- ============================================================================

-- 代理商表 (需先创建，因为 users 表引用)
CREATE TABLE agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- 基本信息
    code VARCHAR(20) NOT NULL UNIQUE,           -- 代理商邀请码 (如: AGENT001)
    name VARCHAR(100) NOT NULL,                 -- 代理商名称
    email VARCHAR(255) NOT NULL UNIQUE,         -- 代理商邮箱

    -- 层级关系 (支持多级代理)
    parent_agent_id UUID REFERENCES agents(id), -- 上级代理商 (NULL=顶级代理)
    level SMALLINT NOT NULL DEFAULT 1,          -- 代理层级 (1=一级, 2=二级...)

    -- 返佣配置
    commission_rate DECIMAL(5,4) NOT NULL DEFAULT 0.1000, -- 返佣比例 (10% = 0.1000)

    -- 统计数据 (冗余字段，定时任务更新)
    total_users INTEGER NOT NULL DEFAULT 0,     -- 累计邀请用户数
    total_commission DECIMAL(18,8) NOT NULL DEFAULT 0, -- 累计返佣金额 (USDT)

    -- 状态
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- active/suspended/terminated

    -- 审计字段
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_agent_level CHECK (level >= 1 AND level <= 5),
    CONSTRAINT chk_agent_commission_rate CHECK (commission_rate >= 0 AND commission_rate <= 1)
);

-- 代理商层级索引
CREATE INDEX idx_agents_parent ON agents(parent_agent_id);
CREATE INDEX idx_agents_code ON agents(code);

-- 用户表
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- 基本认证
    email VARCHAR(255) NOT NULL UNIQUE,         -- 登录邮箱
    password_hash VARCHAR(255) NOT NULL,        -- bcrypt 哈希密码

    -- 2FA 配置 (白皮书要求: 提现需 2FA 验证)
    two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    two_factor_secret VARCHAR(64),              -- TOTP 密钥 (加密存储)

    -- VIP 等级
    vip_level SMALLINT NOT NULL DEFAULT 0,      -- 0=免费, 1=基础, 2=高级, 3=专业
    vip_expires_at TIMESTAMP WITH TIME ZONE,    -- VIP 到期时间

    -- 代理商关联 (白皮书 4.2: 代理商后台)
    agent_id UUID REFERENCES agents(id),        -- 邀请人代理商 ID
    invite_code VARCHAR(20) UNIQUE,             -- 用户自己的邀请码 (可升级为代理)

    -- 设备指纹 (白皮书 5.3: 反作弊)
    device_fingerprints JSONB DEFAULT '[]',     -- 已绑定设备指纹列表

    -- 状态
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- active/suspended/banned
    last_login_at TIMESTAMP WITH TIME ZONE,
    last_login_ip INET,

    -- 审计字段
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_user_vip_level CHECK (vip_level >= 0 AND vip_level <= 3)
);

-- 用户索引
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_agent ON users(agent_id);
CREATE INDEX idx_users_vip_level ON users(vip_level);
CREATE INDEX idx_users_status ON users(status);

-- ============================================================================
-- 模块 2: Resources (资源管理模块)
-- ============================================================================

-- VPS 实例表 (白皮书 2.1: 单租户隔离)
CREATE TABLE instances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- DigitalOcean 信息
    droplet_id VARCHAR(50),                     -- DO Droplet ID
    region VARCHAR(20) NOT NULL DEFAULT 'sgp1', -- 机房区域 (sgp1, sfo3, nyc1...)
    size VARCHAR(20) NOT NULL DEFAULT 's-1vcpu-1gb', -- 规格

    -- 网络信息
    ip_address INET,                            -- 公网 IP (白皮书: IP 独立防封禁)

    -- 状态监控 (白皮书 5.2: 双向心跳熔断)
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending/provisioning/running/stopped/error/destroyed
    last_heartbeat TIMESTAMP WITH TIME ZONE,    -- 最后心跳时间 (15分钟无心跳=僵尸节点)

    -- 资源监控
    cpu_usage DECIMAL(5,2),                     -- CPU 使用率 (%)
    memory_usage DECIMAL(5,2),                  -- 内存使用率 (%)

    -- 生命周期
    provisioned_at TIMESTAMP WITH TIME ZONE,   -- 开机时间
    destroyed_at TIMESTAMP WITH TIME ZONE,     -- 销毁时间
    destroy_reason VARCHAR(100),                -- 销毁原因 (欠费/用户停止/僵尸节点)

    -- 审计字段
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 确保每个用户只有一个活跃实例
CREATE UNIQUE INDEX idx_instances_user_active
    ON instances(user_id)
    WHERE status NOT IN ('destroyed', 'error');

CREATE INDEX idx_instances_status ON instances(status);
CREATE INDEX idx_instances_heartbeat ON instances(last_heartbeat);

-- VPS 备份记录表 (白皮书 2.1: S3 数据灾备)
CREATE TABLE instance_backups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    instance_id UUID NOT NULL REFERENCES instances(id),
    user_id UUID NOT NULL REFERENCES users(id),

    -- 备份信息
    backup_type VARCHAR(20) NOT NULL,               -- auto(定时)/manual(手动)/pre_destroy(销毁前)

    -- S3 存储信息
    s3_bucket VARCHAR(100) NOT NULL,
    s3_key VARCHAR(500) NOT NULL,                   -- 路径: backups/{user_id}/{instance_id}/{timestamp}/
    file_size_bytes BIGINT,                         -- 文件大小

    -- 备份内容
    includes JSONB DEFAULT '["trades.sqlite", "config.json"]', -- 包含的文件列表

    -- 状态
    status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending/uploading/completed/failed
    error_message TEXT,

    -- 恢复信息
    restored_to_instance_id UUID REFERENCES instances(id), -- 恢复到的新实例
    restored_at TIMESTAMP WITH TIME ZONE,

    -- 审计字段
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE              -- 备份过期时间 (可选自动清理)
);

CREATE INDEX idx_instance_backups_instance ON instance_backups(instance_id);
CREATE INDEX idx_instance_backups_user ON instance_backups(user_id);
CREATE INDEX idx_instance_backups_status ON instance_backups(status);

-- API Key 表 (白皮书 2.3: AES-256-GCM 加密)
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- 交易所信息
    exchange VARCHAR(50) NOT NULL,              -- binance/okx/bybit/bitget
    label VARCHAR(100),                         -- 用户自定义标签

    -- 加密存储 (白皮书: 严禁明文落地)
    encrypted_blob BYTEA NOT NULL,              -- AES-256-GCM 加密的 API Key + Secret
    iv BYTEA NOT NULL,                          -- 初始化向量 (12 bytes for GCM)
    auth_tag BYTEA NOT NULL,                    -- GCM 认证标签 (16 bytes)

    -- 权限标识 (从交易所 API 读取)
    permissions JSONB DEFAULT '{"spot": false, "futures": true, "withdraw": false}',

    -- 状态
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_verified_at TIMESTAMP WITH TIME ZONE,  -- 最后验证时间

    -- 审计字段
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_api_keys_user ON api_keys(user_id);
CREATE INDEX idx_api_keys_exchange ON api_keys(exchange);

-- ============================================================================
-- 模块 3: Finance (财务模块)
-- ============================================================================

-- 钱包表 (白皮书 4.1-C: 资产钱包)
CREATE TABLE wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,

    -- USDT 余额
    usdt_balance DECIMAL(18,8) NOT NULL DEFAULT 0,          -- 可用 USDT
    usdt_frozen DECIMAL(18,8) NOT NULL DEFAULT 0,           -- 冻结 USDT (提现审核中)

    -- Q-Points 积分 (白皮书 3.1: 链下积分，无限增发)
    points_balance DECIMAL(18,8) NOT NULL DEFAULT 0,        -- 可用积分
    points_frozen DECIMAL(18,8) NOT NULL DEFAULT 0,         -- 冻结积分 (兑换中)

    -- $QFI 代币 (白皮书 3.1: 链上代币，总量1亿)
    token_balance DECIMAL(18,8) NOT NULL DEFAULT 0,         -- 可用代币
    token_locked DECIMAL(18,8) NOT NULL DEFAULT 0,          -- 锁定代币 (质押中)
    token_vesting DECIMAL(18,8) NOT NULL DEFAULT 0,         -- 释放中代币 (Vesting)

    -- 审计字段
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    -- 余额非负约束
    CONSTRAINT chk_wallet_usdt_balance CHECK (usdt_balance >= 0),
    CONSTRAINT chk_wallet_usdt_frozen CHECK (usdt_frozen >= 0),
    CONSTRAINT chk_wallet_points_balance CHECK (points_balance >= 0),
    CONSTRAINT chk_wallet_points_frozen CHECK (points_frozen >= 0),
    CONSTRAINT chk_wallet_token_balance CHECK (token_balance >= 0),
    CONSTRAINT chk_wallet_token_locked CHECK (token_locked >= 0),
    CONSTRAINT chk_wallet_token_vesting CHECK (token_vesting >= 0)
);

-- 计费日志表 (白皮书 5.2: 计费幂等性)
CREATE TABLE billing_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),

    -- 幂等键 (白皮书: unique_order_id 物理杜绝重复扣费)
    unique_order_id VARCHAR(100) NOT NULL UNIQUE, -- 格式: {type}_{user_id}_{timestamp}_{nonce}

    -- 计费类型
    billing_type VARCHAR(30) NOT NULL,          -- subscription/gas_fee/withdraw_fee/refund

    -- 金额信息
    amount DECIMAL(18,8) NOT NULL,              -- 金额 (正=收入, 负=支出)
    currency VARCHAR(10) NOT NULL DEFAULT 'USDT', -- USDT/POINTS/QFI

    -- 关联信息
    reference_type VARCHAR(50),                 -- 关联对象类型 (instance/trade/stake)
    reference_id UUID,                          -- 关联对象 ID

    -- 描述
    description TEXT,                           -- 计费说明

    -- 状态
    status VARCHAR(20) NOT NULL DEFAULT 'completed', -- pending/completed/failed/refunded

    -- 审计字段
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_billing_logs_user ON billing_logs(user_id);
CREATE INDEX idx_billing_logs_type ON billing_logs(billing_type);
CREATE INDEX idx_billing_logs_created ON billing_logs(created_at);

-- 充值记录表 (白皮书 4.1-C: 资产钱包充值)
CREATE TABLE deposits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),

    -- 充值信息
    amount DECIMAL(18,8) NOT NULL,              -- 充值金额
    currency VARCHAR(10) NOT NULL DEFAULT 'USDT', -- USDT

    -- 充值方式
    method VARCHAR(30) NOT NULL,                -- manual(手动确认)/onchain(链上自动)

    -- 链上信息 (onchain 方式)
    chain VARCHAR(20),                          -- TRC20/ERC20/BEP20
    from_address VARCHAR(100),                  -- 来源地址
    tx_hash VARCHAR(100),                       -- 交易哈希
    block_number BIGINT,                        -- 区块高度
    confirmations INTEGER DEFAULT 0,            -- 确认数

    -- 手动确认信息 (manual 方式)
    proof_image_url VARCHAR(500),               -- 转账截图 S3 URL
    reviewed_by UUID REFERENCES users(id),      -- 审核管理员
    reviewed_at TIMESTAMP WITH TIME ZONE,

    -- 状态
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending/confirming/completed/rejected
    reject_reason TEXT,

    -- 审计字段
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_deposit_amount CHECK (amount > 0)
);

CREATE INDEX idx_deposits_user ON deposits(user_id);
CREATE INDEX idx_deposits_status ON deposits(status);
CREATE INDEX idx_deposits_tx_hash ON deposits(tx_hash) WHERE tx_hash IS NOT NULL;
CREATE INDEX idx_deposits_created ON deposits(created_at);

-- 提现记录表 (白皮书 4.3: 提现审核)
CREATE TABLE withdrawals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),

    -- 提现信息
    amount DECIMAL(18,8) NOT NULL,              -- 提现金额
    currency VARCHAR(10) NOT NULL DEFAULT 'USDT', -- USDT/QFI
    fee DECIMAL(18,8) NOT NULL DEFAULT 0,       -- 手续费

    -- 链上信息
    chain VARCHAR(20) NOT NULL,                 -- TRC20/ERC20/BEP20
    to_address VARCHAR(100) NOT NULL,           -- 目标地址
    tx_hash VARCHAR(100),                       -- 交易哈希 (打款后填写)

    -- 审核流程 (白皮书: 人工核对 Hash)
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending/approved/processing/completed/rejected
    reviewed_by UUID REFERENCES users(id),      -- 审核管理员
    reviewed_at TIMESTAMP WITH TIME ZONE,
    reject_reason TEXT,                         -- 拒绝原因

    -- 2FA 验证 (白皮书: 提现需 2FA)
    two_factor_verified BOOLEAN NOT NULL DEFAULT FALSE,

    -- 审计字段
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_withdrawal_amount CHECK (amount > 0),
    CONSTRAINT chk_withdrawal_fee CHECK (fee >= 0)
);

CREATE INDEX idx_withdrawals_user ON withdrawals(user_id);
CREATE INDEX idx_withdrawals_status ON withdrawals(status);
CREATE INDEX idx_withdrawals_created ON withdrawals(created_at);

-- ============================================================================
-- 模块 4: GameFi (代币经济模块)
-- ============================================================================

-- 质押记录表 (白皮书 3.3: 双轨质押 Dual-Track Staking)
CREATE TABLE stakes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),

    -- 质押类型 (白皮书: A类=空投/积分, B类=本金购买)
    stake_type CHAR(1) NOT NULL,                -- 'A' or 'B'

    -- 质押金额
    amount DECIMAL(18,8) NOT NULL,              -- 质押的 $QFI 数量

    -- 时间信息
    start_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    lock_period_days INTEGER NOT NULL,          -- 锁定天数 (30/90/180/365)
    end_time TIMESTAMP WITH TIME ZONE NOT NULL, -- 到期时间 = start_time + lock_period

    -- 权重计算 (白皮书: veToken 模型)
    -- A类固定 1.0x, B类 1.0x-3.0x 随时间递增
    weight_multiplier DECIMAL(5,2) NOT NULL DEFAULT 1.00,

    -- 收益信息
    accumulated_reward DECIMAL(18,8) NOT NULL DEFAULT 0, -- 累计收益
    last_reward_at TIMESTAMP WITH TIME ZONE,    -- 最后领取收益时间

    -- 状态
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- active/unlocked/early_unstaked

    -- 提前解押信息 (白皮书: A类扣50%本金, B类扣收益+3%手续费)
    early_unstake_at TIMESTAMP WITH TIME ZONE,
    penalty_amount DECIMAL(18,8) DEFAULT 0,     -- 惩罚金额

    -- 审计字段
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_stake_type CHECK (stake_type IN ('A', 'B')),
    CONSTRAINT chk_stake_amount CHECK (amount > 0),
    CONSTRAINT chk_stake_weight CHECK (weight_multiplier >= 1.00 AND weight_multiplier <= 3.00)
);

CREATE INDEX idx_stakes_user ON stakes(user_id);
CREATE INDEX idx_stakes_type ON stakes(stake_type);
CREATE INDEX idx_stakes_status ON stakes(status);
CREATE INDEX idx_stakes_end_time ON stakes(end_time);

-- 代币兑换订单表 (白皮书 3.4: 释放与兑换 Vesting)
CREATE TABLE token_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),

    -- 兑换信息
    points_spent DECIMAL(18,8) NOT NULL,        -- 消耗的积分
    tokens_total DECIMAL(18,8) NOT NULL,        -- 兑换的代币总量
    exchange_rate DECIMAL(18,8) NOT NULL,       -- 兑换汇率 (积分/代币)

    -- 释放模式 (白皮书: 标准=20%+80%线性, 急速=50%+50%销毁)
    vesting_mode VARCHAR(20) NOT NULL DEFAULT 'standard', -- standard/instant

    -- 释放进度 (白皮书: 基于订单隔离，每笔独立计算)
    tokens_released DECIMAL(18,8) NOT NULL DEFAULT 0,     -- 已释放
    tokens_pending DECIMAL(18,8) NOT NULL DEFAULT 0,      -- 待释放
    tokens_burned DECIMAL(18,8) NOT NULL DEFAULT 0,       -- 已销毁 (急速模式)

    -- 释放时间线 (标准模式: 90天线性释放)
    vesting_start_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    vesting_end_at TIMESTAMP WITH TIME ZONE,    -- 标准模式: start + 90 days
    last_release_at TIMESTAMP WITH TIME ZONE,   -- 最后释放时间

    -- 状态
    status VARCHAR(20) NOT NULL DEFAULT 'vesting', -- vesting/completed/cancelled

    -- 审计字段
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_order_points CHECK (points_spent > 0),
    CONSTRAINT chk_order_tokens CHECK (tokens_total > 0),
    CONSTRAINT chk_order_vesting_mode CHECK (vesting_mode IN ('standard', 'instant'))
);

CREATE INDEX idx_token_orders_user ON token_orders(user_id);
CREATE INDEX idx_token_orders_status ON token_orders(status);
CREATE INDEX idx_token_orders_vesting ON token_orders(vesting_end_at) WHERE status = 'vesting';

-- ============================================================================
-- 模块 5: Trading (交易模块)
-- ============================================================================

-- 策略表 (白皮书 4.1-B: 策略中心) - 必须先创建，因为 backtests 引用它
CREATE TABLE strategies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- 策略归属
    owner_type VARCHAR(20) NOT NULL DEFAULT 'system', -- system/user
    owner_id UUID,                              -- 用户ID (system策略为NULL)

    -- 策略信息
    name VARCHAR(100) NOT NULL,                 -- 策略名称
    description TEXT,                           -- 策略描述

    -- 策略内容 (白皮书: AI 生成或官方提供)
    content TEXT NOT NULL,                      -- Python 策略代码
    config JSONB DEFAULT '{}',                  -- 策略配置 (杠杆/止损等)

    -- 性能统计 (回测/实盘数据)
    performance_stats JSONB DEFAULT '{
        "backtest": {
            "total_trades": 0,
            "win_rate": 0,
            "max_drawdown": 0,
            "sharpe_ratio": 0,
            "profit_factor": 0
        },
        "live": {
            "total_trades": 0,
            "win_rate": 0,
            "total_pnl": 0,
            "last_updated": null
        }
    }',

    -- 状态
    is_public BOOLEAN NOT NULL DEFAULT FALSE,   -- 是否公开 (官方策略库)
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    -- 版本控制
    version INTEGER NOT NULL DEFAULT 1,

    -- 审计字段
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_strategies_owner ON strategies(owner_type, owner_id);
CREATE INDEX idx_strategies_public ON strategies(is_public) WHERE is_public = TRUE;

-- 回测任务表 (白皮书 4.1-B: 回测系统)
CREATE TABLE backtests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    strategy_id UUID NOT NULL REFERENCES strategies(id),

    -- 回测配置
    config JSONB NOT NULL DEFAULT '{
        "timerange": "20240101-20241231",
        "stake_amount": 100,
        "stake_currency": "USDT",
        "pairs": ["BTC/USDT", "ETH/USDT"]
    }',

    -- 回测结果
    results JSONB DEFAULT NULL,                 -- 完整回测结果 (Freqtrade 输出)

    -- 关键指标 (从 results 提取，便于查询)
    total_trades INTEGER,                       -- 总交易次数
    win_rate DECIMAL(5,2),                      -- 胜率 (%)
    profit_total DECIMAL(18,8),                 -- 总收益
    profit_percent DECIMAL(8,4),                -- 收益率 (%)
    max_drawdown DECIMAL(8,4),                  -- 最大回撤 (%)
    sharpe_ratio DECIMAL(8,4),                  -- 夏普比率

    -- 状态
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending/running/completed/failed
    error_message TEXT,                         -- 失败原因

    -- 时间
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER,                   -- 执行时长

    -- 审计字段
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_backtests_user ON backtests(user_id);
CREATE INDEX idx_backtests_strategy ON backtests(strategy_id);
CREATE INDEX idx_backtests_status ON backtests(status);
CREATE INDEX idx_backtests_created ON backtests(created_at);

-- 用户策略配置表 (白皮书 4.1-B: 参数自定义/黑名单)
CREATE TABLE user_strategy_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    strategy_id UUID NOT NULL REFERENCES strategies(id),
    instance_id UUID REFERENCES instances(id),       -- 关联的 VPS 实例

    -- 资金配置
    stake_amount DECIMAL(18,8) NOT NULL DEFAULT 100, -- 投入金额 (USDT)
    max_open_trades INTEGER NOT NULL DEFAULT 3,      -- 最大同时持仓数

    -- 风控参数 (白皮书 4.1-B: 杠杆/止损参数自定义)
    leverage SMALLINT NOT NULL DEFAULT 1,            -- 杠杆倍数 (1-20)
    stoploss DECIMAL(5,4) NOT NULL DEFAULT -0.1000,  -- 止损比例 (-10% = -0.1000)
    trailing_stop BOOLEAN NOT NULL DEFAULT FALSE,    -- 是否启用移动止损
    trailing_stop_positive DECIMAL(5,4),             -- 移动止损触发点

    -- 黑名单 (白皮书: 黑名单管理)
    blacklist JSONB DEFAULT '[]',                    -- 不交易的币种 ["DOGE/USDT", "SHIB/USDT"]

    -- 其他配置
    custom_config JSONB DEFAULT '{}',                -- 策略特定的自定义配置

    -- 状态
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    -- 审计字段
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    -- 约束检查
    CONSTRAINT chk_leverage CHECK (leverage >= 1 AND leverage <= 20),
    CONSTRAINT chk_stoploss CHECK (stoploss >= -1 AND stoploss < 0)
);

-- 每个用户每个策略只能有一个活跃配置 (使用部分唯一索引)
CREATE UNIQUE INDEX uq_user_strategy_active
    ON user_strategy_configs(user_id, strategy_id)
    WHERE is_active = TRUE;

CREATE INDEX idx_user_strategy_configs_user ON user_strategy_configs(user_id);
CREATE INDEX idx_user_strategy_configs_strategy ON user_strategy_configs(strategy_id);
CREATE INDEX idx_user_strategy_configs_instance ON user_strategy_configs(instance_id);

-- 交易历史表 (白皮书 4.1-B: 历史交易记录明细)
CREATE TABLE trade_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    instance_id UUID REFERENCES instances(id),
    strategy_id UUID REFERENCES strategies(id),

    -- 交易信息
    exchange VARCHAR(50) NOT NULL,              -- binance/okx/bybit
    symbol VARCHAR(30) NOT NULL,                -- BTC/USDT, ETH/USDT
    side VARCHAR(10) NOT NULL,                  -- buy/sell
    order_type VARCHAR(20) NOT NULL,            -- market/limit

    -- 价格和数量
    entry_price DECIMAL(18,8),                  -- 开仓价
    exit_price DECIMAL(18,8),                   -- 平仓价
    quantity DECIMAL(18,8) NOT NULL,            -- 数量
    leverage SMALLINT DEFAULT 1,                -- 杠杆倍数

    -- 盈亏计算 (白皮书 1.2: 燃油费抽成)
    pnl DECIMAL(18,8),                          -- 盈亏金额 (USDT)
    pnl_percentage DECIMAL(8,4),                -- 盈亏百分比
    gas_fee DECIMAL(18,8) DEFAULT 0,            -- 平台抽成 (盈利的20%)

    -- 状态
    status VARCHAR(20) NOT NULL DEFAULT 'open', -- open/closed/cancelled

    -- 时间戳
    opened_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMP WITH TIME ZONE,

    -- 同步数据 (从 Freqtrade 同步)
    sync_data JSONB DEFAULT '{}',               -- 原始交易数据
    synced_at TIMESTAMP WITH TIME ZONE,

    -- 审计字段
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_trade_history_user ON trade_history(user_id);
CREATE INDEX idx_trade_history_instance ON trade_history(instance_id);
CREATE INDEX idx_trade_history_symbol ON trade_history(symbol);
CREATE INDEX idx_trade_history_status ON trade_history(status);
CREATE INDEX idx_trade_history_opened ON trade_history(opened_at);

-- ============================================================================
-- 模块 6: Platform Economics (平台经济模块)
-- ============================================================================

-- 平台收入分配表 (白皮书 3.2: 收入分配飞轮)
CREATE TABLE revenue_distributions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- 分配周期
    period_start TIMESTAMP WITH TIME ZONE NOT NULL, -- 周期开始
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,   -- 周期结束

    -- 收入总额
    total_revenue DECIMAL(18,8) NOT NULL,           -- 本周期总收入 (USDT)

    -- 分配明细 (白皮书: 40%运营 + 40%回购 + 20%储备)
    operations_amount DECIMAL(18,8) NOT NULL,       -- 40% 运营成本
    buyback_amount DECIMAL(18,8) NOT NULL,          -- 40% 回购奖励池
    reserve_amount DECIMAL(18,8) NOT NULL,          -- 20% 风险储备金

    -- 回购执行
    buyback_executed BOOLEAN NOT NULL DEFAULT FALSE,
    buyback_tx_hash VARCHAR(100),                   -- DEX 回购交易哈希
    tokens_bought DECIMAL(18,8) DEFAULT 0,          -- 回购的 $QFI 数量
    tokens_burned DECIMAL(18,8) DEFAULT 0,          -- 销毁数量 (回购的50%)
    tokens_distributed DECIMAL(18,8) DEFAULT 0,     -- 分发给质押者数量 (回购的50%)

    -- 状态
    status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending/processing/completed

    -- 审计字段
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_revenue_distributions_period ON revenue_distributions(period_start, period_end);
CREATE INDEX idx_revenue_distributions_status ON revenue_distributions(status);

-- 代币销毁记录表 (白皮书 3.2: 回购销毁)
CREATE TABLE token_burns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- 销毁来源
    source_type VARCHAR(30) NOT NULL,               -- buyback(回购销毁)/instant_vesting(急速模式)/early_unstake(提前解押A类)
    source_id UUID,                                 -- 关联的 revenue_distribution/token_order/stake ID

    -- 销毁数量
    amount DECIMAL(18,8) NOT NULL,

    -- 链上信息
    tx_hash VARCHAR(100),                           -- 销毁交易哈希
    burn_address VARCHAR(100) DEFAULT '0x000000000000000000000000000000000000dEaD',

    -- 审计字段
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_burn_amount CHECK (amount > 0)
);

CREATE INDEX idx_token_burns_source ON token_burns(source_type, source_id);
CREATE INDEX idx_token_burns_created ON token_burns(created_at);

-- ============================================================================
-- 辅助表
-- ============================================================================

-- 系统公告表 (白皮书 4.1-A: 公告跑马灯)
CREATE TABLE announcements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    type VARCHAR(20) NOT NULL DEFAULT 'info',   -- info/warning/urgent

    -- 展示配置
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    display_order INTEGER NOT NULL DEFAULT 0,

    -- 生效时间
    start_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    end_at TIMESTAMP WITH TIME ZONE,

    -- 审计字段
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 活跃公告索引 (不使用 NOW() 函数,改为应用层过滤)
CREATE INDEX idx_announcements_active
    ON announcements(start_at, end_at);

-- 代理商返佣记录表 (白皮书 4.2: 实时返佣明细)
CREATE TABLE agent_commissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    agent_id UUID NOT NULL REFERENCES agents(id),
    user_id UUID NOT NULL REFERENCES users(id), -- 贡献用户

    -- 返佣来源
    source_type VARCHAR(30) NOT NULL,           -- subscription/gas_fee
    source_id UUID,                             -- 关联的 billing_log ID

    -- 金额
    base_amount DECIMAL(18,8) NOT NULL,         -- 用户消费金额
    commission_rate DECIMAL(5,4) NOT NULL,      -- 返佣比例
    commission_amount DECIMAL(18,8) NOT NULL,   -- 返佣金额

    -- 状态
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending/settled/paid
    settled_at TIMESTAMP WITH TIME ZONE,

    -- 审计字段
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_agent_commissions_agent ON agent_commissions(agent_id);
CREATE INDEX idx_agent_commissions_user ON agent_commissions(user_id);
CREATE INDEX idx_agent_commissions_status ON agent_commissions(status);

-- 管理员操作日志表 (白皮书 4.3: 上帝视角审计)
CREATE TABLE admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    admin_id UUID NOT NULL REFERENCES users(id),

    -- 操作信息
    action VARCHAR(50) NOT NULL,                -- user_ban/vps_stop/withdrawal_approve
    target_type VARCHAR(50),                    -- user/instance/withdrawal
    target_id UUID,

    -- 操作详情
    details JSONB DEFAULT '{}',
    ip_address INET,

    -- 审计字段
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_admin_audit_logs_admin ON admin_audit_logs(admin_id);
CREATE INDEX idx_admin_audit_logs_action ON admin_audit_logs(action);
CREATE INDEX idx_admin_audit_logs_created ON admin_audit_logs(created_at);

-- ============================================================================
-- 触发器：自动更新 updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 为所有需要的表创建触发器
CREATE TRIGGER update_agents_updated_at BEFORE UPDATE ON agents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_instances_updated_at BEFORE UPDATE ON instances
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_api_keys_updated_at BEFORE UPDATE ON api_keys
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_wallets_updated_at BEFORE UPDATE ON wallets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_withdrawals_updated_at BEFORE UPDATE ON withdrawals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stakes_updated_at BEFORE UPDATE ON stakes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_token_orders_updated_at BEFORE UPDATE ON token_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_strategies_updated_at BEFORE UPDATE ON strategies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trade_history_updated_at BEFORE UPDATE ON trade_history
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_announcements_updated_at BEFORE UPDATE ON announcements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_deposits_updated_at BEFORE UPDATE ON deposits
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_backtests_updated_at BEFORE UPDATE ON backtests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_revenue_distributions_updated_at BEFORE UPDATE ON revenue_distributions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_strategy_configs_updated_at BEFORE UPDATE ON user_strategy_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 初始数据
-- ============================================================================

-- 创建系统管理员用户 (密码需要在部署时修改)
-- INSERT INTO users (email, password_hash, vip_level, status)
-- VALUES ('admin@quantfi.io', '$2b$12$placeholder_hash', 3, 'active');

-- ============================================================================
-- Schema 版本记录
-- ============================================================================

CREATE TABLE schema_migrations (
    version VARCHAR(50) PRIMARY KEY,
    applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    description TEXT
);

INSERT INTO schema_migrations (version, description)
VALUES ('1.0.0', 'Initial schema based on QUANTFI_ULTIMATE_WHITE_PAPER v4.0');

INSERT INTO schema_migrations (version, description)
VALUES ('1.1.0', 'Add deposits, backtests, revenue_distributions, token_burns, instance_backups, user_strategy_configs tables');
