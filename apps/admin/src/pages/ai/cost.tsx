/**
 * AI 智能交易 - Token 成本监控页
 * 按用户展示 LLM 成本明细，支持时间段切换
 */
import {
  Card,
  Table,
  Tabs,
  Space,
  Button,
  Input,
  Typography,
  Statistic,
  Row,
  Col,
} from 'antd';
import { ReloadOutlined, DollarOutlined } from '@ant-design/icons';
import { useState, useEffect, useCallback } from 'react';
import { adminApi } from '../../lib/admin-api';

const { Title, Text } = Typography;
const { Search } = Input;

type Period = 'today' | 'week' | 'month';

interface CostBreakdown {
  userId: string;
  username: string;
  researchCost: string;
  strategyCost: string;
  total: string;
}

interface CostData {
  total: number;
  page: number;
  limit: number;
  totalCost: string;
  breakdown: CostBreakdown[];
  dailyTrend: { date: string; cost: string }[];
}

export const AiCostPage = () => {
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState<Period>('month');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<CostData | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        period,
        page: String(page),
        limit: '20',
        ...(keyword ? { keyword } : {}),
      });
      const res = await adminApi.get<CostData>(`/admin/ai/cost?${params}`);
      setData(res.data.data as CostData);
    } catch (err: any) {
      console.error('加载失败', err);
    } finally {
      setLoading(false);
    }
  }, [period, page, keyword]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handlePeriodChange = (key: string) => {
    setPeriod(key as Period);
    setPage(1);
  };

  const columns = [
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      width: 150,
    },
    {
      title: '研究会话成本',
      dataIndex: 'researchCost',
      key: 'researchCost',
      width: 140,
      render: (v: string) => (
        <Text>$ {parseFloat(v).toFixed(6)}</Text>
      ),
    },
    {
      title: '策略辩论成本',
      dataIndex: 'strategyCost',
      key: 'strategyCost',
      width: 140,
      render: (v: string) => (
        <Text>$ {parseFloat(v).toFixed(6)}</Text>
      ),
    },
    {
      title: '合计',
      dataIndex: 'total',
      key: 'total',
      width: 120,
      sorter: (a: CostBreakdown, b: CostBreakdown) =>
        parseFloat(a.total) - parseFloat(b.total),
      defaultSortOrder: 'descend' as const,
      render: (v: string) => (
        <Text strong style={{ color: '#f5222d' }}>
          $ {parseFloat(v).toFixed(6)}
        </Text>
      ),
    },
  ];

  // 近7天趋势（只显示最近7条）
  const trendData = (data?.dailyTrend || []).slice(-7);
  const trendColumns = [
    { title: '日期', dataIndex: 'date', key: 'date', width: 120 },
    {
      title: '当日成本 (USD)',
      dataIndex: 'cost',
      key: 'cost',
      render: (v: string) => `$ ${parseFloat(v).toFixed(6)}`,
    },
  ];

  const PERIOD_LABELS: Record<Period, string> = {
    today: '今日',
    week: '近7天',
    month: '本月',
  };

  return (
    <div style={{ padding: '24px' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title level={3} style={{ margin: 0 }}>Token 成本监控</Title>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            刷新
          </Button>
        </div>

        {/* 总成本卡片 */}
        <Row gutter={16}>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic
                title={`${PERIOD_LABELS[period]}总 LLM 成本`}
                value={parseFloat(data?.totalCost || '0').toFixed(4)}
                prefix={<DollarOutlined />}
                suffix="USD"
                valueStyle={{ color: '#f5222d' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic
                title="涉及用户数"
                value={data?.total || 0}
                suffix="人"
              />
            </Card>
          </Col>
        </Row>

        {/* 时间段 Tabs */}
        <Card>
          <Tabs
            activeKey={period}
            onChange={handlePeriodChange}
            items={[
              { key: 'today', label: '今日' },
              { key: 'week', label: '近7天' },
              { key: 'month', label: '本月' },
            ]}
          />

          <Space style={{ marginBottom: 16 }}>
            <Search
              placeholder="搜索用户名/邮箱"
              allowClear
              style={{ width: 220 }}
              onSearch={(v) => { setKeyword(v); setPage(1); }}
            />
          </Space>

          <Table
            columns={columns}
            dataSource={data?.breakdown || []}
            rowKey="userId"
            loading={loading}
            pagination={{
              current: page,
              total: data?.total || 0,
              pageSize: 20,
              onChange: (p) => setPage(p),
              showTotal: (t) => `共 ${t} 人`,
            }}
          />
        </Card>

        {/* 近7天趋势表 */}
        <Card title="近7天每日成本趋势">
          <Table
            columns={trendColumns}
            dataSource={trendData}
            rowKey="date"
            pagination={false}
            size="small"
          />
        </Card>
      </Space>
    </div>
  );
};
