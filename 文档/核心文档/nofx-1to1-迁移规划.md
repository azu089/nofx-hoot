# nofx → HOOT 1:1 全量迁移规划

> 目标：将 nofx 全部代码 1:1 移植为独立 TypeScript 项目
> 创建日期：2026-04-03
> 最后更新：2026-04-03
> 状态：规划阶段（PM 已确认关键决策）

---

## PM 决策记录（2026-04-03）

| # | 决策点 | PM 决定 |
|---|--------|---------|
| 1 | CCXT vs 原生 REST | **CCXT + nofx 逻辑层叠加**（省 ~17,000 行，保留所有交易逻辑） |
| 2 | MCP 支付模块 | **不需要**（跳过 BlockRun/x402） |
| 3 | Telegram Bot | **不需要** |
| 4 | 竞赛模块 | **不需要** |
| 5 | 前端路由 | Vite → Next.js App Router 适配，**功能优先** |
| 6 | 前端组件冲突 | **合并为准**（nofx + HOOT 现有 UI 合并） |
| 7 | 项目结构 | **独立目录**，不在现有 HOOT monorepo 内 |

**裁剪后总工作量：~73,000 行**（原 100k - 去掉 Telegram 1.5k - 竞赛 0.8k - MCP 支付 1k - 交易所原生 17k - 测试文件复用）

---

## 0. 迁移原则

1. **1:1 翻译**：nofx 每个函数 → 对应 TS 函数，所有 if/else/switch 分支完全一致
2. **全量覆盖**：不跳过任何函数、任何分支（已裁剪模块除外）
3. **保留所有常量/阈值**：原值不动，注释标注来源 `// nofx: xxx.go:L行号`
4. **技术栈映射**：Go → TypeScript, Gin → NestJS, GORM → Prisma, goroutine → async
5. **测试同步迁移**：nofx 的 _test.go → 对应 .spec.ts
6. **独立项目**：完全独立的目录和 package.json，不依赖现有 HOOT monorepo

---

## 1. 独立项目目录结构

```
nofx-ts/                              ← 独立项目根目录
├── package.json                      ← pnpm workspace
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── docker-compose.yml
├── .env.example
│
├── apps/
│   ├── api/                          ← 后端 NestJS
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── nest-cli.json
│   │   └── src/
│   │       ├── main.ts                           ← nofx: main.go
│   │       ├── app.module.ts
│   │       │
│   │       ├── config/                            ← nofx: config/
│   │       │   └── config.service.ts              ← config.go (144行)
│   │       │
│   │       ├── common/                            ← 基础设施
│   │       │   ├── logger/                        ← nofx: logger/
│   │       │   │   ├── logger.service.ts          ← logger.go (212行)
│   │       │   │   └── logger.config.ts           ← config.go (13行)
│   │       │   ├── crypto/                        ← nofx: crypto/
│   │       │   │   └── crypto.service.ts          ← crypto.go (469行)
│   │       │   ├── security/                      ← nofx: security/
│   │       │   │   └── url-validator.service.ts   ← url_validator.go (217行)
│   │       │   ├── hooks/                         ← nofx: hook/
│   │       │   │   ├── hooks.ts                   ← hooks.go (40行)
│   │       │   │   ├── trader-hook.ts             ← trader_hook.go (42行)
│   │       │   │   ├── http-client-hook.ts        ← http_client_hook.go (23行)
│   │       │   │   └── ip-hook.ts                 ← ip_hook.go (19行)
│   │       │   └── filters/
│   │       │       └── error.filter.ts            ← api/errors.go (95行)
│   │       │
│   │       ├── auth/                              ← nofx: auth/
│   │       │   └── auth.service.ts                ← auth.go (119行)
│   │       │
│   │       ├── store/                             ← nofx: store/ (6,778行)
│   │       │   ├── store.module.ts
│   │       │   ├── store.service.ts               ← store.go (406行)
│   │       │   ├── driver.service.ts              ← driver.go (281行)
│   │       │   ├── position.service.ts            ← position.go (1,216行)
│   │       │   ├── position-builder.service.ts    ← position_builder.go (181行)
│   │       │   ├── order.service.ts               ← order.go (423行)
│   │       │   ├── grid.service.ts                ← grid.go (594行)
│   │       │   ├── trader.service.ts              ← trader.go (270行)
│   │       │   ├── strategy.service.ts            ← strategy.go (512行)
│   │       │   ├── exchange.service.ts            ← exchange.go (338行)
│   │       │   ├── decision.service.ts            ← decision.go (313行)
│   │       │   ├── ai-model.service.ts            ← ai_model.go (250行)
│   │       │   ├── equity.service.ts              ← equity.go (181行)
│   │       │   ├── user.service.ts                ← user.go (127行)
│   │       │   └── backtest.service.ts            ← backtest.go (574行)
│   │       │
│   │       ├── market/                            ← nofx: market/ (2,518行)
│   │       │   ├── market.module.ts
│   │       │   ├── market-data.service.ts         ← data.go (1,344行)
│   │       │   ├── market.types.ts                ← types.go (262行)
│   │       │   ├── market-api.service.ts          ← api_client.go (160行)
│   │       │   ├── historical.service.ts          ← historical.go (104行)
│   │       │   └── timeframe.util.ts              ← timeframe.go (63行)
│   │       │
│   │       ├── provider/                          ← nofx: provider/ (4,492行)
│   │       │   ├── coinank/                       ← coinank/ 全部（含 api/ enum/）
│   │       │   │   ├── coinank.module.ts
│   │       │   │   ├── coinank-http.service.ts    ← coinank_http.go
│   │       │   │   ├── open-interest.service.ts   ← open_interest.go
│   │       │   │   ├── liquidation.service.ts     ← liquidation.go
│   │       │   │   ├── instruments.service.ts     ← instruments.go
│   │       │   │   ├── kline.service.ts           ← kline.go
│   │       │   │   ├── net-positions.service.ts   ← net_positions.go
│   │       │   │   ├── base-coin.service.ts       ← base_coin.go
│   │       │   │   ├── agg-rank.service.ts        ← instrument_agg_rank.go
│   │       │   │   ├── api/                       ← coinank_api/
│   │       │   │   │   ├── kline-ws.service.ts    ← kline_ws.go
│   │       │   │   │   └── depth-ws.service.ts    ← depth_ws.go
│   │       │   │   └── enum/                      ← coinank_enum/
│   │       │   │       ├── sort-by.ts
│   │       │   │       ├── interval.ts
│   │       │   │       ├── exchange.ts
│   │       │   │       └── ...
│   │       │   ├── hyperliquid/                   ← hyperliquid/ (856行)
│   │       │   │   ├── kline.service.ts
│   │       │   │   └── coins.service.ts
│   │       │   ├── nofxos/                        ← nofxos/ (1,238行)
│   │       │   │   ├── client.service.ts
│   │       │   │   ├── netflow.service.ts
│   │       │   │   ├── oi.service.ts
│   │       │   │   ├── coin.service.ts
│   │       │   │   ├── price.service.ts
│   │       │   │   └── ai500.service.ts
│   │       │   ├── alpaca/                        ← alpaca/ (206行)
│   │       │   │   └── kline.service.ts
│   │       │   └── twelvedata/                    ← twelvedata/ (271行)
│   │       │       └── kline.service.ts
│   │       │
│   │       ├── kernel/                            ← nofx: kernel/ (5,541行) ★核心★
│   │       │   ├── kernel.module.ts
│   │       │   ├── engine.service.ts              ← engine.go (2,099行)
│   │       │   ├── grid-engine.service.ts         ← grid_engine.go (618行)
│   │       │   ├── prompt-builder.service.ts      ← prompt_builder.go (376行)
│   │       │   ├── schema.ts                      ← schema.go (555行)
│   │       │   └── formatter.ts                   ← formatter.go (635行)
│   │       │
│   │       ├── mcp/                               ← nofx: mcp/ (不含 payment)
│   │       │   ├── mcp.module.ts
│   │       │   ├── mcp-client.service.ts          ← client.go (741行)
│   │       │   ├── request-builder.ts             ← request_builder.go (317行)
│   │       │   ├── request.types.ts               ← request.go (97行)
│   │       │   ├── mcp-options.ts                 ← options.go (180行)
│   │       │   ├── mcp-config.ts                  ← config.go (72行)
│   │       │   ├── mcp.interface.ts               ← interface.go (28行)
│   │       │   └── provider/                      ← mcp/provider/
│   │       │       ├── claude.provider.ts         ← claude.go (298行)
│   │       │       ├── openai.provider.ts         ← openai.go (73行)
│   │       │       ├── deepseek.provider.ts       ← deepseek.go (69行)
│   │       │       ├── gemini.provider.ts         ← gemini.go (73行)
│   │       │       ├── grok.provider.ts           ← grok.go (73行)
│   │       │       ├── qwen.provider.ts           ← qwen.go (74行)
│   │       │       ├── kimi.provider.ts           ← kimi.go (73行)
│   │       │       └── minimax.provider.ts        ← minimax.go (73行)
│   │       │
│   │       ├── trader/                            ← nofx: trader/ ★核心★
│   │       │   ├── trader.module.ts
│   │       │   ├── trader.types.ts                ← types/interface.go (230行)
│   │       │   ├── trader.interface.ts            ← interface.go (88行)
│   │       │   ├── trader.helpers.ts              ← helpers.go (76行)
│   │       │   ├── auto-trader.service.ts         ← auto_trader.go (589行)
│   │       │   ├── auto-trader-loop.service.ts    ← auto_trader_loop.go (560行)
│   │       │   ├── auto-trader-decision.service.ts ← auto_trader_decision.go (527行)
│   │       │   ├── auto-trader-orders.service.ts  ← auto_trader_orders.go (391行)
│   │       │   ├── auto-trader-risk.service.ts    ← auto_trader_risk.go (263行)
│   │       │   ├── position-rebuild.service.ts    ← position_rebuild.go (195行)
│   │       │   ├── position-snapshot.service.ts   ← position_snapshot.go (103行)
│   │       │   │
│   │       │   ├── grid/                          ← 网格专用
│   │       │   │   ├── grid-trading.service.ts    ← auto_trader_grid.go (1,850行) ★最核心★
│   │       │   │   └── grid-regime.service.ts     ← grid_regime.go (312行)
│   │       │   │
│   │       │   └── exchange/                      ← CCXT + nofx 逻辑层
│   │       │       ├── ccxt-adapter.service.ts    ← 统一 CCXT 适配层
│   │       │       ├── binance/                   ← binance/ order_sync + 特殊逻辑
│   │       │       │   ├── binance.adapter.ts     ← futures.go 特有逻辑 (~400行)
│   │       │       │   └── binance-sync.service.ts ← order_sync.go (371行)
│   │       │       ├── okx/
│   │       │       │   ├── okx.adapter.ts         ← trader.go 特有逻辑 (~400行)
│   │       │       │   └── okx-sync.service.ts    ← order_sync.go (285行)
│   │       │       ├── bybit/
│   │       │       │   ├── bybit.adapter.ts       ← trader.go 特有逻辑 (~400行)
│   │       │       │   └── bybit-sync.service.ts  ← order_sync.go (311行)
│   │       │       ├── kucoin/
│   │       │       │   ├── kucoin.adapter.ts
│   │       │       │   └── kucoin-sync.service.ts ← order_sync.go (412行)
│   │       │       ├── gate/
│   │       │       │   ├── gate.adapter.ts
│   │       │       │   └── gate-sync.service.ts   ← order_sync.go (304行)
│   │       │       ├── hyperliquid/
│   │       │       │   ├── hyperliquid.adapter.ts ← trader.go 特有逻辑 (~600行)
│   │       │       │   └── hyperliquid-sync.service.ts ← order_sync.go (149行)
│   │       │       ├── lighter/
│   │       │       │   ├── lighter.adapter.ts     ← trading.go + account.go (~800行)
│   │       │       │   ├── lighter-orders.service.ts ← orders.go (345行)
│   │       │       │   ├── lighter-sync.service.ts ← order_sync.go (161行)
│   │       │       │   └── lighter.types.ts       ← types.go (154行)
│   │       │       ├── bitget/
│   │       │       │   ├── bitget.adapter.ts
│   │       │       │   └── bitget-sync.service.ts ← order_sync.go (292行)
│   │       │       ├── indodax/
│   │       │       │   └── indodax.adapter.ts     ← trader.go (~400行)
│   │       │       └── aster/
│   │       │           ├── aster.adapter.ts       ← trader.go (~600行)
│   │       │           └── aster-sync.service.ts  ← order_sync.go (193行)
│   │       │
│   │       ├── backtest/                          ← nofx: backtest/ (4,797行)
│   │       │   ├── backtest.module.ts
│   │       │   ├── runner.service.ts              ← runner.go (1,531行)
│   │       │   ├── manager.service.ts             ← manager.go (493行)
│   │       │   ├── storage.service.ts             ← storage.go (561行)
│   │       │   ├── storage-db.service.ts          ← storage_db_impl.go (498行)
│   │       │   ├── backtest-config.ts             ← config.go (285行)
│   │       │   ├── account.service.ts             ← account.go (267行)
│   │       │   ├── metrics.service.ts             ← metrics.go (239行)
│   │       │   ├── registry.service.ts            ← registry.go (160行)
│   │       │   ├── ai-cache.service.ts            ← aicache.go (168行)
│   │       │   ├── datafeed.service.ts            ← datafeed.go (206行)
│   │       │   ├── retention.service.ts           ← retention.go (101行)
│   │       │   ├── lock.service.ts                ← lock.go (100行)
│   │       │   ├── backtest.types.ts              ← types.go (179行)
│   │       │   └── equity.service.ts              ← equity.go (95行)
│   │       │
│   │       ├── manager/                           ← nofx: manager/
│   │       │   └── trader-manager.service.ts      ← trader_manager.go (743行)
│   │       │
│   │       ├── experience/                        ← nofx: experience/
│   │       │   └── experience.service.ts          ← experience.go (240行)
│   │       │
│   │       ├── api/                               ← nofx: api/ (Controller 层)
│   │       │   ├── trader.controller.ts           ← handler_trader.go (1,212行)
│   │       │   ├── order.controller.ts            ← handler_order.go (402行)
│   │       │   ├── kline.controller.ts            ← handler_klines.go (392行)
│   │       │   ├── exchange.controller.ts         ← handler_exchange.go (353行)
│   │       │   ├── ai-model.controller.ts         ← handler_ai_model.go (211行)
│   │       │   ├── user.controller.ts             ← handler_user.go (223行)
│   │       │   ├── strategy.controller.ts         ← strategy.go (667行)
│   │       │   ├── backtest.controller.ts         ← backtest.go (863行)
│   │       │   ├── crypto.controller.ts           ← crypto_handler.go (93行)
│   │       │   └── utils.ts                       ← utils.go (105行)
│   │       │
│   │       ├── scripts/                           ← nofx: scripts/
│   │       │   ├── migrate-encryption.ts          ← migrate_encryption.go (200行)
│   │       │   ├── diagnose-orders.ts             ← diagnose_orders.go (189行)
│   │       │   ├── fix-order-data.ts              ← fix_order_data.go (141行)
│   │       │   ├── clear-orders.ts                ← clear_orders.go (111行)
│   │       │   └── cleanup-duplicates.ts          ← cleanup_duplicates.go (98行)
│   │       │
│   │       └── prisma/                            ← GORM models → Prisma schema
│   │           ├── schema.prisma                  ← 从 store/*.go 提取所有模型
│   │           └── migrations/
│   │
│   └── web/                          ← 前端 Next.js 14
│       ├── package.json
│       ├── next.config.js
│       ├── tailwind.config.ts
│       ├── tsconfig.json
│       └── src/
│           ├── app/                               ← Next.js App Router
│           │   ├── layout.tsx                     ← nofx: App.tsx (674行)
│           │   ├── page.tsx                       ← 首页/Landing
│           │   ├── not-found.tsx                  ← PageNotFound.tsx
│           │   ├── (public)/
│           │   │   ├── login/page.tsx             ← auth/LoginPage.tsx
│           │   │   ├── register/page.tsx          ← auth/RegisterPage.tsx
│           │   │   ├── reset-password/page.tsx    ← auth/ResetPasswordPage.tsx
│           │   │   └── faq/page.tsx               ← FAQPage.tsx
│           │   └── (dashboard)/
│           │       ├── layout.tsx
│           │       ├── dashboard/page.tsx         ← TraderDashboardPage.tsx (876行)
│           │       ├── trading/page.tsx           ← AITradersPage.tsx (2,103行)
│           │       ├── strategies/
│           │       │   ├── page.tsx               ← StrategyMarketPage.tsx (540行)
│           │       │   └── studio/page.tsx        ← StrategyStudioPage.tsx (1,199行)
│           │       ├── backtest/page.tsx           ← BacktestPage.tsx (1,996行)
│           │       ├── data/page.tsx               ← DataPage.tsx
│           │       └── settings/page.tsx           ← SettingsPage.tsx (489行)
│           │
│           ├── components/
│           │   ├── charts/                        ← nofx: charts/ (4,635行)
│           │   │   ├── advanced-chart.tsx
│           │   │   ├── chart-tabs.tsx
│           │   │   ├── chart-with-orders.tsx
│           │   │   ├── chart-with-orders-simple.tsx
│           │   │   ├── comparison-chart.tsx
│           │   │   ├── equity-chart.tsx
│           │   │   └── tradingview-chart.tsx
│           │   ├── trading/                       ← nofx: trader/ (6,421行)
│           │   │   ├── decision-card.tsx
│           │   │   ├── position-history.tsx
│           │   │   ├── exchange-config-modal.tsx
│           │   │   ├── trader-config-modal.tsx
│           │   │   ├── trader-config-view.tsx
│           │   │   └── tooltip.tsx
│           │   ├── strategy/                      ← nofx: strategy/ (3,197行)
│           │   │   ├── coin-source-editor.tsx
│           │   │   ├── indicator-editor.tsx
│           │   │   ├── grid-config-editor.tsx
│           │   │   ├── risk-control-editor.tsx
│           │   │   ├── grid-risk-panel.tsx
│           │   │   ├── publish-settings-editor.tsx
│           │   │   └── prompt-sections-editor.tsx
│           │   ├── auth/                          ← nofx: auth/ (1,409行)
│           │   │   ├── login-page.tsx
│           │   │   ├── register-page.tsx
│           │   │   ├── reset-password-page.tsx
│           │   │   ├── login-required-overlay.tsx
│           │   │   └── registration-disabled.tsx
│           │   ├── landing/                       ← nofx: landing/ (2,723行)
│           │   │   ├── hero-section.tsx
│           │   │   ├── features-section.tsx
│           │   │   ├── how-it-works-section.tsx
│           │   │   ├── community-section.tsx
│           │   │   ├── about-section.tsx
│           │   │   ├── footer-section.tsx
│           │   │   ├── login-modal.tsx
│           │   │   ├── brand/                     ← brand/ 子组件
│           │   │   └── core/                      ← core/ 子组件
│           │   ├── common/                        ← nofx: common/ (2,156行)
│           │   │   ├── header-bar.tsx
│           │   │   ├── metric-tooltip.tsx
│           │   │   ├── punk-avatar.tsx
│           │   │   ├── exchange-icons.tsx
│           │   │   ├── model-icons.tsx
│           │   │   ├── confirm-dialog.tsx
│           │   │   ├── container.tsx
│           │   │   └── deep-void-background.tsx
│           │   ├── faq/                           ← nofx: faq/ (715行)
│           │   ├── modals/                        ← nofx: modals/ (462行)
│           │   │   ├── setup-page.tsx
│           │   │   └── two-stage-key-modal.tsx
│           │   └── ui/                            ← shadcn/ui 基础组件
│           │
│           ├── types/                             ← nofx: types.ts (717行)
│           │   └── index.ts
│           ├── lib/                               ← nofx: lib/ (2,357行)
│           │   ├── api.ts
│           │   ├── http-client.ts
│           │   ├── crypto.ts
│           │   ├── config.ts
│           │   ├── clipboard.ts
│           │   ├── notify.tsx
│           │   ├── text.ts
│           │   └── cn.ts
│           ├── hooks/                             ← nofx: hooks/ (171行)
│           │   ├── use-counter-animation.ts
│           │   ├── use-github-stats.ts
│           │   └── use-system-config.ts
│           ├── stores/                            ← nofx: stores/ (185行)
│           │   ├── traders-config-store.ts
│           │   └── traders-modal-store.ts
│           ├── contexts/                          ← nofx: contexts/ (357行)
│           │   ├── auth-context.tsx
│           │   └── language-context.tsx
│           ├── constants/                         ← nofx: constants/ (73行)
│           │   └── branding.ts
│           ├── i18n/                              ← nofx: i18n/ (3,486行)
│           │   ├── translations.ts
│           │   └── strategy-translations.ts
│           ├── utils/                             ← nofx: utils/ (382行)
│           │   ├── format.ts
│           │   ├── indicators.ts
│           │   └── trader-colors.ts
│           ├── data/                              ← nofx: data/ (372行)
│           │   └── faq-data.ts
│           └── styles/
│               └── globals.css
│
├── packages/                         ← 共享包（如需要）
│   └── shared/
│       ├── package.json
│       └── src/
│           └── types.ts              ← 前后端共享类型
│
├── reference/                        ← nofx 原始代码（只读参考）
│   └── nofx/ → symlink 或 copy
│
└── docs/
    ├── migration-map.md              ← 函数级 Go↔TS 映射表
    └── architecture.md               ← 架构说明
```

---

## 2. 技术栈映射表

| nofx (Go) | nofx-ts (TypeScript) | 说明 |
|---|---|---|
| Go struct | TypeScript interface/class | 数据结构 |
| Gin router | NestJS Controller + Module | API 路由 |
| GORM | Prisma ORM | 数据库操作 |
| goroutine + channel | async-await + BullMQ | 并发任务 |
| sync.Mutex | 内存锁 (Map/Set) | 并发控制 |
| net/http | axios | HTTP 客户端 |
| encoding/json | JSON.parse/stringify + zod | 序列化 |
| math | decimal.js（资金） / Math（非资金） | 数学运算 |
| regexp | RegExp (JS 内置) | 正则表达式 |
| time.Duration | ms 数值 / dayjs | 时间处理 |
| log/slog | NestJS Logger / winston | 日志 |
| crypto/* | Node.js crypto 模块 | 加密 |
| context.Context | AbortController / NestJS 生命周期 | 上下文 |
| error return | throw + try/catch | 错误处理 |
| go test | Jest | 测试框架 |
| Gin middleware | NestJS Guard/Interceptor/Pipe | 中间件 |
| React (Vite) | Next.js 14 (App Router) | 前端框架 |
| Zustand | Zustand / TanStack Query | 状态管理 |
| TailwindCSS | TailwindCSS | 样式（保持） |
| 交易所原生 REST | CCXT + 逻辑叠加层 | 交易所适配 |

---

## 3. 执行阶段（按依赖链 + 业务价值排序）

### 阶段 1: 地基层（P0 — 所有模块依赖）

**目标：项目能启动，数据库能连接，基础工具可用**

| 任务 | nofx 来源 | 行数 | 说明 |
|------|----------|------|------|
| 1.1 项目脚手架 | — | ~200 | pnpm workspace + NestJS + Next.js 初始化 |
| 1.2 配置管理 | config/config.go | 144 | 环境变量加载 |
| 1.3 日志系统 | logger/ | 225 | 日志服务 |
| 1.4 加密工具 | crypto/crypto.go | 469 | AES-256-GCM |
| 1.5 安全工具 | security/url_validator.go | 217 | URL 验证 |
| 1.6 钩子系统 | hook/ | 124 | 钩子框架 |
| 1.7 认证模块 | auth/auth.go | 119 | JWT/认证 |
| 1.8 Prisma Schema | store/*.go 所有模型 | ~800 | GORM → Prisma 转换 |

**小计：~2,298 行 + 脚手架**

---

### 阶段 2: 数据层（P0 — 交易/AI/API 都要读写数据）

**目标：所有 CRUD 可用，数据持久化正常**

| 任务 | nofx 来源 | 行数 |
|------|----------|------|
| 2.1 Store 总入口 | store/store.go + driver.go | 687 |
| 2.2 持仓管理 | store/position.go + position_builder.go | 1,397 |
| 2.3 订单管理 | store/order.go | 423 |
| 2.4 网格数据 | store/grid.go | 594 |
| 2.5 交易员管理 | store/trader.go | 270 |
| 2.6 策略管理 | store/strategy.go | 512 |
| 2.7 交易所配置 | store/exchange.go | 338 |
| 2.8 AI 决策记录 | store/decision.go | 313 |
| 2.9 AI 模型 | store/ai_model.go | 250 |
| 2.10 权益记录 | store/equity.go | 181 |
| 2.11 用户数据 | store/user.go | 127 |
| 2.12 回测数据 | store/backtest.go | 574 |

**小计：5,666 行**

---

### 阶段 3: 市场数据 + 数据源（P0 — 交易决策需要行情）

**目标：能获取 K线、OI、资金费率等市场数据**

| 任务 | nofx 来源 | 行数 |
|------|----------|------|
| 3.1 市场数据主服务 | market/data.go | 1,344 |
| 3.2 市场类型 | market/types.go | 262 |
| 3.3 API 客户端 | market/api_client.go | 160 |
| 3.4 历史数据 | market/historical.go | 104 |
| 3.5 时间周期 | market/timeframe.go | 63 |
| 3.6 CoinAnk 全套 | provider/coinank/ | 1,921 |
| 3.7 Hyperliquid 数据 | provider/hyperliquid/ | 856 |
| 3.8 NofxOS 数据 | provider/nofxos/ | 1,238 |
| 3.9 Alpaca 数据 | provider/alpaca/ | 206 |
| 3.10 TwelveData | provider/twelvedata/ | 271 |

**小计：6,425 行**

---

### 阶段 4: AI 内核（P0 — 交易循环的大脑）

**目标：能调用 AI 模型，解析决策 JSON，构建 prompt**

| 任务 | nofx 来源 | 行数 |
|------|----------|------|
| 4.1 AI 决策引擎 | kernel/engine.go | 2,099 |
| 4.2 网格 prompt 引擎 | kernel/grid_engine.go | 618 |
| 4.3 通用 prompt 构建 | kernel/prompt_builder.go | 376 |
| 4.4 输出 Schema | kernel/schema.go | 555 |
| 4.5 数据格式化 | kernel/formatter.go | 635 |
| 4.6 MCP 客户端 | mcp/client.go | 741 |
| 4.7 请求构建 | mcp/request_builder.go | 317 |
| 4.8 MCP 配置 | mcp/options.go + config.go + 其他 | ~350 |
| 4.9 AI 提供商 (8个) | mcp/provider/*.go | 816 |

**小计：6,507 行**

---

### 阶段 5: 交易核心（P0 — 赚钱引擎） ★★★

**目标：网格策略能跑，订单能下，风控能拦**

| 任务 | nofx 来源 | 行数 |
|------|----------|------|
| 5.1 AutoTrader 主结构 | trader/auto_trader.go | 589 |
| 5.2 交易主循环 | trader/auto_trader_loop.go | 560 |
| 5.3 **网格交易核心** | trader/auto_trader_grid.go | **1,850** |
| 5.4 AI 决策执行 | trader/auto_trader_decision.go | 527 |
| 5.5 下单执行 | trader/auto_trader_orders.go | 391 |
| 5.6 风控模块 | trader/auto_trader_risk.go | 263 |
| 5.7 **箱体突破** | trader/grid_regime.go | 312 |
| 5.8 持仓重建 | trader/position_rebuild.go | 195 |
| 5.9 持仓快照 | trader/position_snapshot.go | 103 |
| 5.10 接口/类型 | trader/interface.go + types/ + helpers.go | 394 |
| 5.11 CCXT 统一适配层 | 新建（基于 nofx 交易所共性） | ~500 |
| 5.12 Binance 适配+同步 | trader/binance/ 特有逻辑 | ~771 |
| 5.13 OKX 适配+同步 | trader/okx/ 特有逻辑 | ~685 |
| 5.14 Bybit 适配+同步 | trader/bybit/ 特有逻辑 | ~711 |
| 5.15 KuCoin 适配+同步 | trader/kucoin/ 特有逻辑 | ~712 |
| 5.16 Gate 适配+同步 | trader/gate/ 特有逻辑 | ~604 |
| 5.17 Hyperliquid 适配+同步 | trader/hyperliquid/ 特有逻辑 | ~749 |
| 5.18 Lighter 适配+同步 | trader/lighter/ 特有逻辑 | ~1,300 |
| 5.19 Bitget 适配+同步 | trader/bitget/ 特有逻辑 | ~592 |
| 5.20 Indodax 适配 | trader/indodax/ | ~400 |
| 5.21 Aster 适配+同步 | trader/aster/ | ~793 |

**小计：~12,001 行**

---

### 阶段 6: 回测 + 管理 + API（P1 — 系统可用）

**目标：回测能跑，API 可访问，交易员可管理**

| 任务 | nofx 来源 | 行数 |
|------|----------|------|
| 6.1 回测引擎全套 | backtest/ | 4,797 |
| 6.2 交易员管理器 | manager/trader_manager.go | 743 |
| 6.3 经验系统 | experience/experience.go | 240 |
| 6.4 API Controller (全部) | api/*.go | ~4,521 |
| 6.5 工具脚本 | scripts/ | 739 |

**小计：~11,040 行**

---

### 阶段 7: 前端基础层（P1）

**目标：前端项目能运行，API 对接，认证可用**

| 任务 | nofx 来源 | 行数 |
|------|----------|------|
| 7.1 Next.js 脚手架 | — | ~200 |
| 7.2 全局类型 | types.ts | 717 |
| 7.3 API 客户端 | lib/ | 2,357 |
| 7.4 状态管理 | stores/ + contexts/ | 542 |
| 7.5 工具函数 | utils/ + hooks/ + constants/ | 626 |
| 7.6 国际化 | i18n/ | 3,486 |
| 7.7 认证组件 | components/auth/ | 1,409 |
| 7.8 通用组件 | components/common/ + ui/ + modals/ | 2,784 |

**小计：~12,121 行**

---

### 阶段 8: 前端核心页面（P2）

**目标：交易、策略、回测、仪表盘页面全部可用**

| 任务 | nofx 来源 | 行数 |
|------|----------|------|
| 8.1 图表组件全套 | components/charts/ | 4,635 |
| 8.2 交易页面+组件 | components/trader/ + pages/Trading | 6,421 |
| 8.3 策略编辑器全套 | components/strategy/ | 3,197 |
| 8.4 回测页面 | components/backtest/ | 1,996 |
| 8.5 仪表盘 | pages/TraderDashboard | 876 |
| 8.6 策略市场+工作室 | pages/StrategyMarket + Studio | 1,739 |
| 8.7 设置页 | pages/Settings | 489 |
| 8.8 数据页 | pages/Data | 16 |

**小计：~19,369 行**

---

### 阶段 9: 前端 Landing + FAQ（P3）

**目标：公开页面完整**

| 任务 | nofx 来源 | 行数 |
|------|----------|------|
| 9.1 Landing 全套 | components/landing/ + LandingPage | 2,804 |
| 9.2 FAQ 全套 | components/faq/ + FAQPage + data/ | 1,108 |
| 9.3 404 页面 | PageNotFound | 43 |

**小计：~3,955 行**

---

## 4. 总工作量汇总

| 阶段 | 内容 | 行数 | 优先级 |
|------|------|------|--------|
| 阶段 1 | 地基层 | ~2,298 | P0 |
| 阶段 2 | 数据层 | ~5,666 | P0 |
| 阶段 3 | 市场+数据源 | ~6,425 | P0 |
| 阶段 4 | AI 内核 | ~6,507 | P0 |
| 阶段 5 | 交易核心 | ~12,001 | P0 |
| 阶段 6 | 回测+管理+API | ~11,040 | P1 |
| 阶段 7 | 前端基础 | ~12,121 | P1 |
| 阶段 8 | 前端核心页面 | ~19,369 | P2 |
| 阶段 9 | Landing+FAQ | ~3,955 | P3 |
| **合计** | | **~79,382** | |

---

## 5. 关键风险

| # | 风险 | 缓解措施 |
|---|------|----------|
| 1 | GORM → Prisma 模型不完全兼容 | 逐表核对字段类型，写迁移脚本 |
| 2 | Go 并发模型 vs Node.js 单线程 | 关键锁逻辑用 Map/Set 内存锁替代 sync.Mutex |
| 3 | nofx 依赖的外部 API（NofxOS 等）可能无法访问 | 先 mock，后接入 |
| 4 | Lighter/Hyperliquid 等 DEX 的原生实现无 CCXT 支持 | 这些交易所保留原生 REST 实现 |
| 5 | 前端 Vite SPA → Next.js App Router 路由差异 | 逻辑 1:1，路由结构适配 |

---

## 6. 验证策略

每个阶段完成后：

1. **函数映射表**：nofx Go 函数 ↔ TS 函数 1:1 清单
2. **分支覆盖**：每个 if/else/switch 分支有对应
3. **常量一致**：阈值、超时、重试次数完全一致
4. **测试通过**：nofx _test.go 用例在 .spec.ts 复现
5. **端到端验证**：阶段 5 完成后，网格策略能实际运行

---

## 7. 与现有 HOOT 的关系

- **nofx-ts 是独立项目**，不在 HOOT monorepo 内
- 现有 HOOT 的 grid-trading.service.ts 等文件**不受影响**
- 前端采用**合并策略**：nofx UI 功能 + HOOT 现有 UI 设计语言
- 未来可选择：用 nofx-ts 替换 HOOT 对应模块，或两者并行

---

> 文档版本：v2.0
> 更新日期：2026-04-03
> PM 确认：交易所用 CCXT、去掉 Telegram/竞赛/MCP支付、独立目录、前端合并
