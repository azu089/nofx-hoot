/**
 * 数据看板页面
 * HOOT 平台核心业务数据概览
 *
 * 已对接真实 API: GET /admin/dashboard
 */
import { useState, useEffect } from 'react';
import { Card, Col, Row, Statistic, Typography, Table, Tag, Space, Badge, Alert, Spin, message } from 'antd';
import {
  UserOutlined,
  DollarOutlined,
  RiseOutlined,
  ThunderboltOutlined,
  ClockCircleOutlined,
  SafetyOutlined,
  BellOutlined,
  FireOutlined,
  ReloadOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import { api } from '../../lib/api';

const { Title, Text } = Typography;

// API 返回的仪表盘数据类型
interface DashboardStats {
  totalUsers: number;
  activeStrategies: number;
  pendingWithdraws: number;
  todaySignals: number;
  totalPositions: number;
}

// 统计卡片组件
const StatCard = ({
  title,
  value,
  prefix,
  suffix,
  color,
  loading = false,
}: {
  title: string;
  value: number;
  prefix?: React.ReactNode;
  suffix?: string;
  color: string;
  loading?: boolean;
}) => (
  <Card size="small" style={{ height: '100%' }}>
    <Spin spinning={loading}>
      <Statistic
        title={<span style={{ color: '#999', fontSize: 13 }}>{title}</span>}
        value={value}
        prefix={prefix}
        suffix={suffix}
        valueStyle={{ color, fontSize: 24, fontWeight: 600 }}
      />
    </Spin>
  </Card>
);

export const DashboardPage = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 获取仪表盘数据
  const fetchDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<DashboardStats>('/admin/dashboard');
      setStats(data);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '获取数据失败';
      setError(errorMessage);
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
    // 每 60 秒自动刷新
    const interval = setInterval(fetchDashboard, 60000);
    return () => clearInterval(interval);
  }, []);

  const totalPendingTasks = stats?.pendingWithdraws || 0;

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>数据看板</Title>
        <Space>
          <Text type="secondary">数据更新时间: {new Date().toLocaleString('zh-CN')}</Text>
          <Tag
            icon={<ReloadOutlined spin={loading} />}
            color="blue"
            style={{ cursor: 'pointer' }}
            onClick={fetchDashboard}
          >
            刷新
          </Tag>
        </Space>
      </div>

      {/* 错误提示 */}
      {error && (
        <Alert
          message="数据加载失败"
          description={error}
          type="error"
          showIcon
          style={{ marginBottom: 24 }}
          action={
            <Tag color="blue" style={{ cursor: 'pointer' }} onClick={fetchDashboard}>
              重试
            </Tag>
          }
        />
      )}

      {/* 待处理提醒 */}
      {totalPendingTasks > 0 && (
        <Alert
          message={
            <Space>
              <BellOutlined />
              <span>您有 {totalPendingTasks} 项待处理任务</span>
              {stats?.pendingWithdraws ? (
                <Tag color="red">{stats.pendingWithdraws} 笔提现待审核</Tag>
              ) : null}
            </Space>
          }
          type="warning"
          showIcon={false}
          style={{ marginBottom: 24 }}
          closable
        />
      )}

      {/* ====== 核心指标 ====== */}
      <Title level={5} style={{ marginBottom: 16, color: '#666' }}>
        <FireOutlined style={{ marginRight: 8 }} />核心指标
      </Title>
      <Row gutter={[16, 16]} style={{ marginBottom: 32 }}>
        <Col xs={24} sm={12} md={4}>
          <StatCard
            title="总用户数"
            value={stats?.totalUsers || 0}
            prefix={<UserOutlined />}
            color="#1890ff"
            loading={loading}
          />
        </Col>
        <Col xs={24} sm={12} md={5}>
          <StatCard
            title="活跃策略"
            value={stats?.activeStrategies || 0}
            prefix={<SafetyOutlined />}
            color="#52c41a"
            loading={loading}
          />
        </Col>
        <Col xs={24} sm={12} md={5}>
          <StatCard
            title="今日信号数"
            value={stats?.todaySignals || 0}
            prefix={<ThunderboltOutlined />}
            color="#722ed1"
            loading={loading}
          />
        </Col>
        <Col xs={24} sm={12} md={5}>
          <StatCard
            title="持仓订单"
            value={stats?.totalPositions || 0}
            prefix={<RiseOutlined />}
            color="#13c2c2"
            loading={loading}
          />
        </Col>
        <Col xs={24} sm={12} md={5}>
          <Card size="small">
            <Spin spinning={loading}>
              <Statistic
                title={<span style={{ color: '#999', fontSize: 13 }}>待审核提现</span>}
                value={stats?.pendingWithdraws || 0}
                valueStyle={{
                  color: (stats?.pendingWithdraws || 0) > 0 ? '#f5222d' : '#52c41a',
                  fontSize: 24,
                  fontWeight: 600
                }}
                prefix={<ClockCircleOutlined />}
                suffix="笔"
              />
              <div style={{ marginTop: 8 }}>
                <Badge
                  status={(stats?.pendingWithdraws || 0) > 0 ? 'error' : 'success'}
                  text={(stats?.pendingWithdraws || 0) > 0 ? '需要处理' : '无待处理'}
                />
              </div>
            </Spin>
          </Card>
        </Col>
      </Row>

      {/* ====== 快捷入口 ====== */}
      <Title level={5} style={{ marginBottom: 16, color: '#666' }}>
        <WalletOutlined style={{ marginRight: 8 }} />快捷入口
      </Title>
      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card
            title="用户管理"
            size="small"
            hoverable
            onClick={() => window.location.href = '/users'}
            style={{ cursor: 'pointer' }}
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text>总用户</Text>
                <Text strong>{stats?.totalUsers || 0}</Text>
              </div>
              <Text type="secondary">查看用户列表、管理用户状态</Text>
            </Space>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card
            title="策略管理"
            size="small"
            hoverable
            onClick={() => window.location.href = '/strategies'}
            style={{ cursor: 'pointer' }}
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text>活跃策略</Text>
                <Text strong style={{ color: '#52c41a' }}>{stats?.activeStrategies || 0}</Text>
              </div>
              <Text type="secondary">管理策略上下架、查看策略表现</Text>
            </Space>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card
            title="提现审核"
            size="small"
            hoverable
            onClick={() => window.location.href = '/finance/withdrawals'}
            style={{ cursor: 'pointer' }}
            extra={
              (stats?.pendingWithdraws || 0) > 0 ? (
                <Badge count={stats?.pendingWithdraws} />
              ) : null
            }
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text>待审核</Text>
                <Text strong style={{ color: (stats?.pendingWithdraws || 0) > 0 ? '#f5222d' : '#52c41a' }}>
                  {stats?.pendingWithdraws || 0} 笔
                </Text>
              </div>
              <Text type="secondary">审核用户提现申请</Text>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* 数据说明 */}
      <div style={{ marginTop: 32, padding: 16, background: '#1f1f1f', borderRadius: 8 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          💡 提示：数据每 60 秒自动刷新，也可点击右上角"刷新"按钮手动更新。
          如需查看更详细的数据，请进入对应的管理页面。
        </Text>
      </div>
    </div>
  );
};
