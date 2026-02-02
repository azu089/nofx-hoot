/**
 * 代理商代币资产页面
 * 展示私募配额 + 分红收益
 */
import { useEffect } from 'react';
import { Row, Col, Spin, Alert, Card, Typography, Tag, Table, Progress, Statistic, Empty, Divider } from 'antd';
import {
  WalletOutlined,
  GiftOutlined, TrophyOutlined, ArrowUpOutlined, ArrowDownOutlined,
} from '@ant-design/icons';

import { PageHeader } from './components';
import { useAgentApi } from './hooks';
import { cardStyle, colors } from './constants';

const { Text } = Typography;

interface TokenAssetData {
  agent: { id: string; name: string; level: string };
  quota: {
    totalQuota: string;
    releasedAmount: string;
    pendingAmount: string;
    totalCost: string;
    currentValue: string;
  };
  dividend: {
    totalHoot: string;
    totalUsdt: string;
    paidHoot: string;
    pendingHoot: string;
    currentValue: string;
  };
  summary: {
    totalHoot: string;
    pendingHoot: string;
    totalInvestment: string;
    currentValue: string;
    hootPrice: string;
    profitRate: string;
  };
}

interface QuotaItem {
  id: string;
  level: string;
  quotaAmount: string;
  purchasePrice: string;
  purchaseAmount: string;
  vestingMonths: number;
  vestingStart: string | null;
  releasedAmount: string;
  pendingAmount: string;
  releaseProgress: string;
  status: string;
  createdAt: string;
  approvedAt: string | null;
}

interface DividendItem {
  id: string;
  month: string;
  userTradeVolume: string;
  contributionRate: string;
  dividendUsdt: string;
  dividendHoot: string;
  hootPrice: string;
  status: string;
  paidAt: string | null;
  createdAt: string;
}

const levelLabels: Record<string, string> = {
  bronze: '普通代理',
  silver: '银牌代理',
  gold: '金牌代理',
  platinum: '钻石代理',
};

const statusMap: Record<string, { color: string; text: string }> = {
  pending: { color: 'processing', text: '待购买' },
  paid: { color: 'warning', text: '待审核' },
  active: { color: 'success', text: '释放中' },
  completed: { color: 'default', text: '已完成' },
  revoked: { color: 'error', text: '已撤销' },
};

export default function TokenAssetsPage() {
  const { loading: assetsLoading, data: assetsData, fetchApi: fetchAssets } = useAgentApi<TokenAssetData>();
  const { loading: quotasLoading, data: quotasData, fetchApi: fetchQuotas } = useAgentApi<{ items: QuotaItem[] }>();
  const { loading: dividendsLoading, data: dividendsData, fetchApi: fetchDividends } = useAgentApi<{ items: DividendItem[] }>();

  useEffect(() => {
    fetchAssets('/agent/token/assets');
    fetchQuotas('/agent/token/quotas');
    fetchDividends('/agent/token/dividends?limit=10');
  }, []);

  if (assetsLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 100 }}>
        <Spin size="large" />
        <div style={{ marginTop: 16, color: colors.textSecondary }}>正在加载数据...</div>
      </div>
    );
  }

  if (!assetsData) {
    return (
      <Alert
        message="数据加载失败"
        description="请检查网络连接或重新登录后再试"
        type="error"
        showIcon
      />
    );
  }

  const { quota, dividend, summary } = assetsData;
  const profitRate = parseFloat(summary.profitRate);

  // 配额表格列
  const quotaColumns = [
    {
      title: '配额等级',
      dataIndex: 'level',
      key: 'level',
      render: (level: string) => <Tag color="blue">{levelLabels[level] || level}</Tag>,
    },
    {
      title: '配额数量',
      dataIndex: 'quotaAmount',
      key: 'quotaAmount',
      render: (v: string) => <Text strong>{parseFloat(v).toLocaleString()} HOOT</Text>,
    },
    {
      title: '购买价格',
      dataIndex: 'purchasePrice',
      key: 'purchasePrice',
      render: (v: string) => `$${v}`,
    },
    {
      title: '释放进度',
      key: 'progress',
      render: (_: unknown, record: QuotaItem) => (
        <div style={{ width: 120 }}>
          <Progress percent={parseFloat(record.releaseProgress)} size="small" />
          <Text type="secondary" style={{ fontSize: 12 }}>
            {parseFloat(record.releasedAmount).toLocaleString()} / {parseFloat(record.quotaAmount).toLocaleString()}
          </Text>
        </div>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={statusMap[status]?.color || 'default'}>
          {statusMap[status]?.text || status}
        </Tag>
      ),
    },
  ];

  // 分红记录列
  const dividendColumns = [
    {
      title: '月份',
      dataIndex: 'month',
      key: 'month',
    },
    {
      title: '交易贡献',
      dataIndex: 'userTradeVolume',
      key: 'userTradeVolume',
      render: (v: string) => `$${parseFloat(v).toLocaleString()}`,
    },
    {
      title: '贡献比例',
      dataIndex: 'contributionRate',
      key: 'contributionRate',
      render: (v: string) => `${v}%`,
    },
    {
      title: '分红 HOOT',
      dataIndex: 'dividendHoot',
      key: 'dividendHoot',
      render: (v: string) => <Text style={{ color: colors.success }}>{parseFloat(v).toLocaleString()}</Text>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'paid' ? 'success' : 'warning'}>
          {status === 'paid' ? '已发放' : '待发放'}
        </Tag>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="代币资产 - 私募配额与分红收益"
        icon={<WalletOutlined style={{ color: colors.primary }} />}
      />

      {/* 资产概览 */}
      <Card style={{ ...cardStyle, marginBottom: 16 }}>
        <Row gutter={24}>
          <Col xs={24} md={6}>
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <Text style={{ color: colors.textSecondary, fontSize: 13 }}>总代币 (HOOT)</Text>
              <div style={{ fontSize: 28, fontWeight: 'bold', color: colors.primary, marginTop: 8 }}>
                {parseFloat(summary.totalHoot).toLocaleString()}
              </div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                待释放: {parseFloat(summary.pendingHoot).toLocaleString()}
              </Text>
            </div>
          </Col>
          <Col xs={24} md={6}>
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <Text style={{ color: colors.textSecondary, fontSize: 13 }}>当前价值</Text>
              <div style={{ fontSize: 28, fontWeight: 'bold', color: colors.success, marginTop: 8 }}>
                ${parseFloat(summary.currentValue).toLocaleString()}
              </div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                HOOT 价格: ${summary.hootPrice}
              </Text>
            </div>
          </Col>
          <Col xs={24} md={6}>
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <Text style={{ color: colors.textSecondary, fontSize: 13 }}>总投入</Text>
              <div style={{ fontSize: 28, fontWeight: 'bold', color: colors.textPrimary, marginTop: 8 }}>
                ${parseFloat(summary.totalInvestment).toLocaleString()}
              </div>
            </div>
          </Col>
          <Col xs={24} md={6}>
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <Text style={{ color: colors.textSecondary, fontSize: 13 }}>收益率</Text>
              <div style={{ fontSize: 28, fontWeight: 'bold', color: profitRate >= 0 ? colors.success : colors.error, marginTop: 8 }}>
                {profitRate >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                {' '}{Math.abs(profitRate).toFixed(2)}%
              </div>
            </div>
          </Col>
        </Row>
      </Card>

      <Row gutter={16}>
        {/* 私募配额 */}
        <Col xs={24} md={12}>
          <Card
            title={<><TrophyOutlined style={{ color: '#ffd700', marginRight: 8 }} />私募配额</>}
            style={{ ...cardStyle, marginBottom: 16 }}
          >
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={12}>
                <Statistic
                  title="配额总量"
                  value={parseFloat(quota.totalQuota)}
                  suffix="HOOT"
                  valueStyle={{ color: colors.primary, fontSize: 20 }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="已释放"
                  value={parseFloat(quota.releasedAmount)}
                  suffix="HOOT"
                  valueStyle={{ color: colors.success, fontSize: 20 }}
                />
              </Col>
            </Row>
            <Divider style={{ margin: '12px 0' }} />
            <Row gutter={16}>
              <Col span={12}>
                <Text type="secondary">购买成本</Text>
                <div style={{ fontSize: 16, fontWeight: 'bold' }}>${parseFloat(quota.totalCost).toLocaleString()}</div>
              </Col>
              <Col span={12}>
                <Text type="secondary">当前价值</Text>
                <div style={{ fontSize: 16, fontWeight: 'bold', color: colors.success }}>${parseFloat(quota.currentValue).toLocaleString()}</div>
              </Col>
            </Row>
          </Card>
        </Col>

        {/* 分红收益 */}
        <Col xs={24} md={12}>
          <Card
            title={<><GiftOutlined style={{ color: colors.success, marginRight: 8 }} />分红收益</>}
            style={{ ...cardStyle, marginBottom: 16 }}
          >
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={12}>
                <Statistic
                  title="累计分红"
                  value={parseFloat(dividend.totalHoot)}
                  suffix="HOOT"
                  valueStyle={{ color: colors.success, fontSize: 20 }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="已发放"
                  value={parseFloat(dividend.paidHoot)}
                  suffix="HOOT"
                  valueStyle={{ color: colors.primary, fontSize: 20 }}
                />
              </Col>
            </Row>
            <Divider style={{ margin: '12px 0' }} />
            <Row gutter={16}>
              <Col span={12}>
                <Text type="secondary">待发放</Text>
                <div style={{ fontSize: 16, fontWeight: 'bold', color: colors.warning }}>{parseFloat(dividend.pendingHoot).toLocaleString()} HOOT</div>
              </Col>
              <Col span={12}>
                <Text type="secondary">当前价值</Text>
                <div style={{ fontSize: 16, fontWeight: 'bold', color: colors.success }}>${parseFloat(dividend.currentValue).toLocaleString()}</div>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      {/* 配额明细 */}
      <Card
        title="配额明细"
        style={{ ...cardStyle, marginBottom: 16 }}
      >
        <Table
          dataSource={quotasData?.items || []}
          columns={quotaColumns}
          rowKey="id"
          loading={quotasLoading}
          pagination={false}
          locale={{ emptyText: <Empty description="暂无配额记录" /> }}
        />
      </Card>

      {/* 分红记录 */}
      <Card
        title="近期分红记录"
        style={cardStyle}
      >
        <Table
          dataSource={dividendsData?.items || []}
          columns={dividendColumns}
          rowKey="id"
          loading={dividendsLoading}
          pagination={false}
          locale={{ emptyText: <Empty description="暂无分红记录" /> }}
        />
      </Card>
    </div>
  );
}
