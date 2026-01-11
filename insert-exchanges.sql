-- 插入交易所推广链接初始数据

INSERT INTO exchange_links (
  id,
  exchange_id,
  name,
  logo,
  rebate,
  link,
  description,
  features,
  is_active,
  sort_order,
  created_at,
  updated_at
) VALUES
  (
    gen_random_uuid(),
    'binance',
    'Binance',
    '🟡',
    '20%',
    'https://www.binance.com/zh-CN/register?ref=QUANTFI',
    '全球最大的加密货币交易所',
    '["现货交易", "合约交易", "流动性最高", "API 稳定"]'::jsonb,
    true,
    1,
    NOW(),
    NOW()
  ),
  (
    gen_random_uuid(),
    'okx',
    'OKX',
    '⚫',
    '20%',
    'https://www.okx.com/join/QUANTFI',
    '优质的综合性交易平台',
    '["现货交易", "合约交易", "手续费低", "API 完善"]'::jsonb,
    true,
    2,
    NOW(),
    NOW()
  ),
  (
    gen_random_uuid(),
    'bybit',
    'Bybit',
    '🔶',
    '20%',
    'https://www.bybit.com/invite?ref=QUANTFI',
    '专注衍生品的新兴交易所',
    '["合约交易", "杠杆交易", "新手友好", "体验流畅"]'::jsonb,
    true,
    3,
    NOW(),
    NOW()
  )
ON CONFLICT (exchange_id) DO NOTHING;
