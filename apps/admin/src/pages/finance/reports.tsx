/**
 * 财务报表页面
 */
import { Card, Row, Col, Statistic, Typography, DatePicker, Select, Space, Table, Tag, Button } from 'antd';
import { DollarOutlined, ArrowUpOutlined, ArrowDownOutlined, DownloadOutlined, RiseOutlined, SwapOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { useMessage } from '../../hooks';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

interface IReportData {
  date: string;
  income: number;
  subscription: number;
  gasFee: number;
  commission: number;
  expense: number;
  withdrawal: number;
  agentCommission: number;
  netProfit: number;
}

interface IIncomeBreakdown {
  type: string;
  amount: string;
  percent: number;
  trend: 'up' | 'down' | 'flat';
  trendValue: string;
}

const mockReportData: IReportData[] = [
  { date: '2025-01-30', income: 12580, subscription: 5280, gasFee: 6500, commission: 800, expense: 3250, withdrawal: 2500, agentCommission: 750, netProfit: 9330 },
  { date: '2025-01-29', income: 11200, subscription: 4800, gasFee: 5800, commission: 600, expense: 2980, withdrawal: 2200, agentCommission: 780, netProfit: 8220 },
  { date: '2025-01-28', income: 13500, subscription: 6200, gasFee: 6500, commission: 800, expense: 3500, withdrawal: 2800, agentCommission: 700, netProfit: 10000 },
  { date: '2025-01-27', income: 10800, subscription: 4500, gasFee: 5600, commission: 700, expense: 2800, withdrawal: 2100, agentCommission: 700, netProfit: 8000 },
  { date: '2025-01-26', income: 14200, subscription: 6800, gasFee: 6600, commission: 800, expense: 3800, withdrawal: 3000, agentCommission: 800, netProfit: 10400 },
];

const mockIncomeBreakdown: IIncomeBreakdown[] = [
  { type: '订阅费', amount: '32,580.00', percent: 42, trend: 'up', trendValue: '+12.5%' },
  { type: 'Gas Fee', amount: '35,000.00', percent: 45, trend: 'up', trendValue: '+8.2%' },
  { type: '利润分成', amount: '10,100.00', percent: 13, trend: 'down', trendValue: '-3.1%' },
];

export const FinanceReportsPage = () => {
  const message = useMessage();
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('day');

  // 汇总数据
  const totalIncome = mockReportData.reduce((sum, d) => sum + d.income, 0);
  const totalExpense = mockReportData.reduce((sum, d) => sum + d.expense, 0);
  const totalNetProfit = mockReportData.reduce((sum, d) => sum + d.netProfit, 0);
  const avgDailyIncome = totalIncome / mockReportData.length;

  const columns = [
    { title: '日期', dataIndex: 'date', key: 'date' },
    { title: '总收入', dataIndex: 'income', key: 'income', render: (v: number) => <Text type="success">${v.toLocaleString()}</Text> },
    { title: '订阅收入', dataIndex: 'subscription', key: 'subscription', render: (v: number) => `$${v.toLocaleString()}` },
    { title: 'Gas Fee', dataIndex: 'gasFee', key: 'gasFee', render: (v: number) => `$${v.toLocaleString()}` },
    { title: '分成收入', dataIndex: 'commission', key: 'commission', render: (v: number) => `$${v.toLocaleString()}` },
    { title: '总支出', dataIndex: 'expense', key: 'expense', render: (v: number) => <Text type="danger">${v.toLocaleString()}</Text> },
    { title: '提现', dataIndex: 'withdrawal', key: 'withdrawal', render: (v: number) => `$${v.toLocaleString()}` },
    { title: '代理返佣', dataIndex: 'agentCommission', key: 'agentCommission', render: (v: number) => `$${v.toLocaleString()}` },
    { title: '净利润', dataIndex: 'netProfit', key: 'netProfit', render: (v: number) => <Text strong type={v >= 0 ? 'success' : 'danger'}>${v.toLocaleString()}</Text> },
  ];

  const breakdownColumns = [
    { title: '收入类型', dataIndex: 'type', key: 'type', render: (t: string) => <Text strong>{t}</Text> },
    { title: '金额 (USDT)', dataIndex: 'amount', key: 'amount' },
    { title: '占比', dataIndex: 'percent', key: 'percent', render: (p: number) => <Tag color="blue">{p}%</Tag> },
    {
      title: '趋势',
      key: 'trend',
      render: (_: unknown, record: IIncomeBreakdown) => (
        <Space>
          {record.trend === 'up' ? <ArrowUpOutlined style={{ color: '#52c41a' }} /> : record.trend === 'down' ? <ArrowDownOutlined style={{ color: '#f5222d' }} /> : <SwapOutlined />}
          <Text type={record.trend === 'up' ? 'success' : record.trend === 'down' ? 'danger' : 'secondary'}>{record.trendValue}</Text>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>财务报表</Title>
        <Space>
          <Select value={period} onChange={setPeriod} style={{ width: 100 }} options={[{ value: 'day', label: '按日' }, { value: 'week', label: '按周' }, { value: 'month', label: '按月' }]} />
          <RangePicker />
          <Button icon={<DownloadOutlined />} onClick={() => message.success('导出成功')}>导出报表</Button>
        </Space>
      </div>

      {/* 核心指标 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic title="总收入" value={totalIncome} precision={2} prefix={<DollarOutlined />} suffix="USDT" valueStyle={{ color: '#52c41a' }} />
            <div style={{ marginTop: 8 }}><Text type="secondary">较上期 </Text><Text type="success"><RiseOutlined /> +15.3%</Text></div>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="总支出" value={totalExpense} precision={2} prefix={<DollarOutlined />} suffix="USDT" valueStyle={{ color: '#f5222d' }} />
            <div style={{ marginTop: 8 }}><Text type="secondary">较上期 </Text><Text type="danger"><RiseOutlined /> +8.2%</Text></div>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="净利润" value={totalNetProfit} precision={2} prefix={<DollarOutlined />} suffix="USDT" valueStyle={{ color: '#1890ff' }} />
            <div style={{ marginTop: 8 }}><Text type="secondary">利润率 </Text><Text type="success">{((totalNetProfit / totalIncome) * 100).toFixed(1)}%</Text></div>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="日均收入" value={avgDailyIncome} precision={2} prefix={<DollarOutlined />} suffix="USDT" />
            <div style={{ marginTop: 8 }}><Text type="secondary">较上期 </Text><Text type="success"><RiseOutlined /> +5.8%</Text></div>
          </Card>
        </Col>
      </Row>

      {/* 收入构成 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={12}>
          <Card title="收入构成">
            <Table dataSource={mockIncomeBreakdown} columns={breakdownColumns} rowKey="type" pagination={false} />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="支出构成">
            <Table
              dataSource={[
                { type: '用户提现', amount: '12,600.00', percent: 72, trend: 'up', trendValue: '+10.2%' },
                { type: '代理返佣', amount: '3,730.00', percent: 21, trend: 'up', trendValue: '+5.5%' },
                { type: '其他支出', amount: '1,200.00', percent: 7, trend: 'flat', trendValue: '0%' },
              ]}
              columns={breakdownColumns}
              rowKey="type"
              pagination={false}
            />
          </Card>
        </Col>
      </Row>

      {/* 明细数据 */}
      <Card title="收支明细">
        <Table dataSource={mockReportData} columns={columns} rowKey="date" pagination={{ pageSize: 10 }} summary={() => (
          <Table.Summary fixed>
            <Table.Summary.Row>
              <Table.Summary.Cell index={0}><Text strong>合计</Text></Table.Summary.Cell>
              <Table.Summary.Cell index={1}><Text strong type="success">${totalIncome.toLocaleString()}</Text></Table.Summary.Cell>
              <Table.Summary.Cell index={2}>${mockReportData.reduce((s, d) => s + d.subscription, 0).toLocaleString()}</Table.Summary.Cell>
              <Table.Summary.Cell index={3}>${mockReportData.reduce((s, d) => s + d.gasFee, 0).toLocaleString()}</Table.Summary.Cell>
              <Table.Summary.Cell index={4}>${mockReportData.reduce((s, d) => s + d.commission, 0).toLocaleString()}</Table.Summary.Cell>
              <Table.Summary.Cell index={5}><Text strong type="danger">${totalExpense.toLocaleString()}</Text></Table.Summary.Cell>
              <Table.Summary.Cell index={6}>${mockReportData.reduce((s, d) => s + d.withdrawal, 0).toLocaleString()}</Table.Summary.Cell>
              <Table.Summary.Cell index={7}>${mockReportData.reduce((s, d) => s + d.agentCommission, 0).toLocaleString()}</Table.Summary.Cell>
              <Table.Summary.Cell index={8}><Text strong type="success">${totalNetProfit.toLocaleString()}</Text></Table.Summary.Cell>
            </Table.Summary.Row>
          </Table.Summary>
        )} />
      </Card>
    </div>
  );
};
