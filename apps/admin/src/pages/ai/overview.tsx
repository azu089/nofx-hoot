/**
 * AI 智能交易 - 总览页
 * 展示全平台 AI 运行状态、成本、Top 用户
 */
import {
  Card,
  Row,
  Col,
  Statistic,
  Table,
  Typography,
  Spin,
  Space,
} from 'antd';
import {
  RobotOutlined,
  DollarOutlined,
  ThunderboltOutlined,
  PlayCircleOutlined,
} from '@ant-design/icons';
import { useState, useEffect } from 'react';
import { adminApi } from '../../lib/admin-api';
import { useMessage } from '../../hooks';

const { Title, Text } = Typography;

interface AiOverviewData {
  totalStrategies: number;
  activeStrategies: number;
  totalResearchSessions: number;
  todayDecisions: number;
  todayTotalCost: string;
  monthTotalCost: string;
  avgWinRate: string;
  topCostUsers: { userId: string; username: string; cost: string }[];
}

export const AiOverviewPage = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AiOverviewData | null>(null);
  const messageApi = useMessage();

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await adminApi.get<AiOverviewData>('/admin/ai/overview');
      setData(res.data.data as AiOverviewData);
    } catch (err: any) {
      messageApi.error('加载数据失败：' + (err.message || '未知错误'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const topUserColumns = [
    {
      title: '排名',
      key: 'rank',
      render: (_: any, __: any, index: number) => (
        <Text strong style={{ color: index < 3 ? '#faad14' : undefined }}>
          #{index + 1}
        </Text>
      ),
      width: 60,
    },
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
    },
    {
      title: '本月成本 (USD)',
      dataIndex: 'cost',
      key: 'cost',
      render: (v: string) => (
        <Text type="warning">${parseFloat(v).toFixed(4)}</Text>
      ),
      sorter: (a: any, b: any) => parseFloat(a.cost) - parseFloat(b.cost),
      defaultSortOrder: 'descend' as const,
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Title level={3} style={{ margin: 0 }}>
          <RobotOutlined style={{ marginRight: 8 }} />
          AI 智能交易总览
        </Title>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px' }}>
            <Spin size="large" />
          </div>
        ) : (
          <>
            {/* 核心指标 */}
            <Row gutter={16}>
              <Col xs={24} sm={12} lg={6}>
                <Card>
                  <Statistic
                    title="运行中策略"
                    value={data?.activeStrategies || 0}
                    suffix={`/ ${data?.totalStrategies || 0} 总计`}
                    prefix={<PlayCircleOutlined style={{ color: '#52c41a' }} />}
                    valueStyle={{ color: '#52c41a' }}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <Card>
                  <Statistic
                    title="今日 AI 决策次数"
                    value={data?.todayDecisions || 0}
                    prefix={<ThunderboltOutlined style={{ color: '#1677ff' }} />}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <Card>
                  <Statistic
                    title="今日 LLM 成本"
                    value={parseFloat(data?.todayTotalCost || '0').toFixed(4)}
                    prefix={<DollarOutlined style={{ color: '#faad14' }} />}
                    suffix="USD"
                    valueStyle={{ color: '#faad14' }}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <Card>
                  <Statistic
                    title="本月 LLM 成本"
                    value={parseFloat(data?.monthTotalCost || '0').toFixed(4)}
                    prefix={<DollarOutlined style={{ color: '#f5222d' }} />}
                    suffix="USD"
                    valueStyle={{ color: '#f5222d' }}
                  />
                </Card>
              </Col>
            </Row>

            {/* 第二行：研究会话 + 平均胜率 */}
            <Row gutter={16}>
              <Col xs={24} sm={12} lg={6}>
                <Card>
                  <Statistic
                    title="总研究会话数"
                    value={data?.totalResearchSessions || 0}
                    prefix={<RobotOutlined />}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <Card>
                  <Statistic
                    title="全平台平均胜率"
                    value={parseFloat(data?.avgWinRate || '0').toFixed(1)}
                    suffix="%"
                    valueStyle={{
                      color: parseFloat(data?.avgWinRate || '0') >= 50 ? '#52c41a' : '#f5222d',
                    }}
                  />
                </Card>
              </Col>
            </Row>

            {/* Top10 成本用户 */}
            <Card title="本月 LLM 成本 Top10 用户">
              <Table
                columns={topUserColumns}
                dataSource={data?.topCostUsers || []}
                rowKey="userId"
                pagination={false}
                size="small"
              />
            </Card>
          </>
        )}
      </Space>
    </div>
  );
};
