/**
 * 财务中心页面
 * 收入三分类统计：订阅费、点卡、燃油费
 */
import { useState, useEffect } from 'react';
import {
  Card,
  Col,
  Row,
  Statistic,
  Typography,
  Table,
  Tag,
  Space,
  Spin,
  DatePicker,
  Tabs,
  Progress,
  Empty,
} from 'antd';
import {
  DollarOutlined,
  CreditCardOutlined,
  FireOutlined,
  TrophyOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { api } from '../../lib/api';
import dayjs from 'dayjs';
import { useMessage } from '../../hooks';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

// 财务概览数据类型
interface FinanceOverview {
  summary: {
    totalRevenue: string;
    subscriptionRevenue: string;
    pointCardRevenue: string;
    gasFeeRevenue: string;
    pendingWithdraws: string;
  };
  subscription: {
    total: string;
    count: number;
    byStrategy: Array<{
      strategyId: string;
      strategyName: string;
      amount: string;
      count: number;
    }>;
  };
  pointCard: {
    total: string;
    count: number;
    consumed: {
      amount: string;
      count: number;
    };
  };
  gasFee: {
    total: string;
    totalProfit: string;
    count: number;
    byExchange: Array<{
      exchange: string;
      feeAmount: string;
      profitAmount: string;
      count: number;
    }>;
    pendingDividend: string;
  };
}

// 统计卡片组件
const StatCard = ({
  title,
  value,
  prefix,
  suffix,
  color,
  subTitle,
  subValue,
  loading = false,
}: {
  title: string;
  value: string;
  prefix?: React.ReactNode;
  suffix?: string;
  color: string;
  subTitle?: string;
  subValue?: string;
  loading?: boolean;
}) => (
  <Card size="small" style={{ height: '100%' }}>
    <Spin spinning={loading}>
      <Statistic
        title={<span style={{ color: '#999', fontSize: 13 }}>{title}</span>}
        value={parseFloat(value) || 0}
        prefix={prefix}
        suffix={suffix}
        valueStyle={{ color, fontSize: 24, fontWeight: 600 }}
        precision={2}
      />
      {subTitle && (
        <div style={{ marginTop: 8 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {subTitle}: <Text style={{ color: '#52c41a' }}>{subValue}</Text>
          </Text>
        </div>
      )}
    </Spin>
  </Card>
);

export const FinancePage = () => {
  const message = useMessage();
  const [data, setData] = useState<FinanceOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);

  // 获取财务数据
  const fetchFinanceData = async () => {
    setLoading(true);
    try {
      let url = '/admin/finance/overview';
      if (dateRange) {
        url += `?startDate=${dateRange[0].format('YYYY-MM-DD')}&endDate=${dateRange[1].format('YYYY-MM-DD')}`;
      }
      const result = await api.get<FinanceOverview>(url);
      setData(result);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '获取数据失败';
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFinanceData();
  }, [dateRange]);

  // 计算占比
  const getPercentage = (value: string, total: string) => {
    const v = parseFloat(value) || 0;
    const t = parseFloat(total) || 1;
    return ((v / t) * 100).toFixed(1);
  };

  // 订阅策略表格列
  const strategyColumns = [
    { title: '策略名称', dataIndex: 'strategyName', key: 'strategyName' },
    {
      title: '收入金额',
      dataIndex: 'amount',
      key: 'amount',
      render: (val: string) => `$${parseFloat(val).toFixed(2)}`,
    },
    { title: '订阅次数', dataIndex: 'count', key: 'count' },
    {
      title: '占比',
      key: 'percentage',
      render: (_: any, record: any) => (
        <Tag color="blue">{getPercentage(record.amount, data?.subscription.total || '1')}%</Tag>
      ),
    },
  ];

  // 交易所表格列
  const exchangeColumns = [
    { title: '交易所', dataIndex: 'exchange', key: 'exchange' },
    {
      title: '燃油费',
      dataIndex: 'feeAmount',
      key: 'feeAmount',
      render: (val: string) => `$${parseFloat(val).toFixed(2)}`,
    },
    {
      title: '用户盈利',
      dataIndex: 'profitAmount',
      key: 'profitAmount',
      render: (val: string) => `$${parseFloat(val).toFixed(2)}`,
    },
    { title: '笔数', dataIndex: 'count', key: 'count' },
  ];

  return (
    <div style={{ padding: '24px' }}>
      {/* 标题和筛选 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>
          <DollarOutlined style={{ marginRight: 8 }} />
          财务中心
        </Title>
        <Space>
          <RangePicker
            onChange={(dates) => setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs] | null)}
            placeholder={['开始日期', '结束日期']}
          />
          <Tag
            icon={<ReloadOutlined spin={loading} />}
            color="blue"
            style={{ cursor: 'pointer' }}
            onClick={fetchFinanceData}
          >
            刷新
          </Tag>
        </Space>
      </div>

      {/* 收入概览 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} md={6}>
          <StatCard
            title="总收入"
            value={data?.summary.totalRevenue || '0'}
            prefix={<TrophyOutlined />}
            suffix="USDT"
            color="#faad14"
            loading={loading}
          />
        </Col>
        <Col xs={24} md={6}>
          <StatCard
            title="订阅收入"
            value={data?.summary.subscriptionRevenue || '0'}
            prefix={<CreditCardOutlined />}
            suffix="USDT"
            color="#1890ff"
            subTitle="笔数"
            subValue={data?.subscription.count?.toString() || '0'}
            loading={loading}
          />
        </Col>
        <Col xs={24} md={6}>
          <StatCard
            title="点卡充值"
            value={data?.summary.pointCardRevenue || '0'}
            prefix={<CreditCardOutlined />}
            suffix="USDT"
            color="#52c41a"
            subTitle="笔数"
            subValue={data?.pointCard.count?.toString() || '0'}
            loading={loading}
          />
        </Col>
        <Col xs={24} md={6}>
          <StatCard
            title="燃油费"
            value={data?.summary.gasFeeRevenue || '0'}
            prefix={<FireOutlined />}
            suffix="USDT"
            color="#f5222d"
            subTitle="待分红"
            subValue={`$${parseFloat(data?.gasFee.pendingDividend || '0').toFixed(2)}`}
            loading={loading}
          />
        </Col>
      </Row>

      {/* 收入占比 */}
      <Card title="收入构成" size="small" style={{ marginBottom: 24 }}>
        <Row gutter={16}>
          <Col span={8}>
            <div style={{ textAlign: 'center' }}>
              <Text type="secondary">订阅收入</Text>
              <Progress
                type="circle"
                percent={parseFloat(getPercentage(
                  data?.summary.subscriptionRevenue || '0',
                  data?.summary.totalRevenue || '1'
                ))}
                size={80}
                strokeColor="#1890ff"
              />
            </div>
          </Col>
          <Col span={8}>
            <div style={{ textAlign: 'center' }}>
              <Text type="secondary">点卡充值</Text>
              <Progress
                type="circle"
                percent={parseFloat(getPercentage(
                  data?.summary.pointCardRevenue || '0',
                  data?.summary.totalRevenue || '1'
                ))}
                size={80}
                strokeColor="#52c41a"
              />
            </div>
          </Col>
          <Col span={8}>
            <div style={{ textAlign: 'center' }}>
              <Text type="secondary">燃油费</Text>
              <Progress
                type="circle"
                percent={parseFloat(getPercentage(
                  data?.summary.gasFeeRevenue || '0',
                  data?.summary.totalRevenue || '1'
                ))}
                size={80}
                strokeColor="#f5222d"
              />
            </div>
          </Col>
        </Row>
      </Card>

      {/* 详细数据 */}
      <Tabs
        defaultActiveKey="subscription"
        items={[
          {
            key: 'subscription',
            label: (
              <span>
                <CreditCardOutlined /> 订阅收入
              </span>
            ),
            children: (
              <Card size="small">
                <Row gutter={16} style={{ marginBottom: 16 }}>
                  <Col span={8}>
                    <Statistic
                      title="总订阅收入"
                      value={parseFloat(data?.subscription.total || '0')}
                      precision={2}
                      prefix="$"
                    />
                  </Col>
                  <Col span={8}>
                    <Statistic
                      title="订阅次数"
                      value={data?.subscription.count || 0}
                    />
                  </Col>
                  <Col span={8}>
                    <Statistic
                      title="策略数量"
                      value={data?.subscription.byStrategy?.length || 0}
                    />
                  </Col>
                </Row>
                <Table
                  columns={strategyColumns}
                  dataSource={data?.subscription.byStrategy || []}
                  rowKey="strategyId"
                  size="small"
                  pagination={false}
                  locale={{ emptyText: <Empty description="暂无数据" /> }}
                />
              </Card>
            ),
          },
          {
            key: 'pointCard',
            label: (
              <span>
                <CreditCardOutlined /> 点卡充值
              </span>
            ),
            children: (
              <Card size="small">
                <Row gutter={16}>
                  <Col span={6}>
                    <Statistic
                      title="充值总额"
                      value={parseFloat(data?.pointCard.total || '0')}
                      precision={2}
                      prefix="$"
                      valueStyle={{ color: '#52c41a' }}
                    />
                  </Col>
                  <Col span={6}>
                    <Statistic
                      title="充值笔数"
                      value={data?.pointCard.count || 0}
                    />
                  </Col>
                  <Col span={6}>
                    <Statistic
                      title="消费总额"
                      value={parseFloat(data?.pointCard.consumed?.amount || '0')}
                      precision={2}
                      prefix="$"
                      valueStyle={{ color: '#f5222d' }}
                    />
                  </Col>
                  <Col span={6}>
                    <Statistic
                      title="消费笔数"
                      value={data?.pointCard.consumed?.count || 0}
                    />
                  </Col>
                </Row>
                <div style={{ marginTop: 16, padding: 16, background: '#1a1a2e', borderRadius: 8 }}>
                  <Text type="secondary">
                    点卡与 USDT 1:1 兑换，用户可使用点卡支付订阅费用。
                  </Text>
                </div>
              </Card>
            ),
          },
          {
            key: 'gasFee',
            label: (
              <span>
                <FireOutlined /> 燃油费
              </span>
            ),
            children: (
              <Card size="small">
                <Row gutter={16} style={{ marginBottom: 16 }}>
                  <Col span={6}>
                    <Statistic
                      title="燃油费总额"
                      value={parseFloat(data?.gasFee.total || '0')}
                      precision={2}
                      prefix="$"
                      valueStyle={{ color: '#f5222d' }}
                    />
                  </Col>
                  <Col span={6}>
                    <Statistic
                      title="用户盈利总额"
                      value={parseFloat(data?.gasFee.totalProfit || '0')}
                      precision={2}
                      prefix="$"
                      valueStyle={{ color: '#52c41a' }}
                    />
                  </Col>
                  <Col span={6}>
                    <Statistic
                      title="收费笔数"
                      value={data?.gasFee.count || 0}
                    />
                  </Col>
                  <Col span={6}>
                    <Statistic
                      title="待分红池"
                      value={parseFloat(data?.gasFee.pendingDividend || '0')}
                      precision={2}
                      prefix="$"
                      valueStyle={{ color: '#faad14' }}
                    />
                  </Col>
                </Row>
                <Table
                  columns={exchangeColumns}
                  dataSource={data?.gasFee.byExchange || []}
                  rowKey="exchange"
                  size="small"
                  pagination={false}
                  locale={{ emptyText: <Empty description="暂无数据" /> }}
                />
                <div style={{ marginTop: 16, padding: 16, background: '#1a1a2e', borderRadius: 8 }}>
                  <Text type="secondary">
                    燃油费为用户盈利交易的 20%，50% 进入质押分红池，每周日发放。
                  </Text>
                </div>
              </Card>
            ),
          },
        ]}
      />
    </div>
  );
};
