/**
 * 系统监控页面
 * 服务状态、性能指标、告警信息
 */
import {
  Card,
  Row,
  Col,
  Statistic,
  Tag,
  Table,
  Progress,
  Space,
  Typography,
  Alert,
  Timeline,
  Button,
} from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  WarningOutlined,
  CloudServerOutlined,
  DatabaseOutlined,
  ApiOutlined,
  ThunderboltOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useState, useEffect } from 'react';

const { Title, Text } = Typography;

interface IServiceStatus {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  latency: number;
  uptime: string;
  lastCheck: string;
}

interface ISystemMetric {
  name: string;
  value: number;
  max: number;
  unit: string;
  status: 'normal' | 'warning' | 'critical';
}

interface IAlertLog {
  id: string;
  level: 'info' | 'warning' | 'error';
  message: string;
  service: string;
  time: string;
}

// 模拟服务状态
const mockServices: IServiceStatus[] = [
  {
    name: 'API Gateway',
    status: 'healthy',
    latency: 45,
    uptime: '99.99%',
    lastCheck: '2025-01-30 14:30:00',
  },
  {
    name: 'PostgreSQL',
    status: 'healthy',
    latency: 12,
    uptime: '99.95%',
    lastCheck: '2025-01-30 14:30:00',
  },
  {
    name: 'Redis Cache',
    status: 'healthy',
    latency: 3,
    uptime: '100%',
    lastCheck: '2025-01-30 14:30:00',
  },
  {
    name: 'Signal Engine',
    status: 'healthy',
    latency: 28,
    uptime: '99.90%',
    lastCheck: '2025-01-30 14:30:00',
  },
  {
    name: 'Blockchain Listener',
    status: 'degraded',
    latency: 850,
    uptime: '98.50%',
    lastCheck: '2025-01-30 14:30:00',
  },
  {
    name: 'Notification Service',
    status: 'healthy',
    latency: 120,
    uptime: '99.80%',
    lastCheck: '2025-01-30 14:30:00',
  },
];

// 模拟系统指标
const mockMetrics: ISystemMetric[] = [
  { name: 'CPU 使用率', value: 35, max: 100, unit: '%', status: 'normal' },
  { name: '内存使用', value: 6.2, max: 16, unit: 'GB', status: 'normal' },
  { name: '磁盘使用', value: 145, max: 500, unit: 'GB', status: 'normal' },
  { name: '网络入流量', value: 125, max: 1000, unit: 'Mbps', status: 'normal' },
  { name: '网络出流量', value: 85, max: 1000, unit: 'Mbps', status: 'normal' },
  { name: '活跃连接数', value: 1250, max: 10000, unit: '', status: 'normal' },
];

// 模拟告警日志
const mockAlerts: IAlertLog[] = [
  {
    id: '1',
    level: 'warning',
    message: '区块链节点响应延迟超过阈值 (>500ms)',
    service: 'Blockchain Listener',
    time: '2025-01-30 14:25:00',
  },
  {
    id: '2',
    level: 'info',
    message: '系统自动清理过期会话，共清理 1,256 条',
    service: 'Session Manager',
    time: '2025-01-30 14:00:00',
  },
  {
    id: '3',
    level: 'info',
    message: '定时任务执行完成：每日分红计算',
    service: 'Scheduler',
    time: '2025-01-30 00:15:00',
  },
  {
    id: '4',
    level: 'error',
    message: '交易所 API 连接失败，自动重试中',
    service: 'Exchange Connector',
    time: '2025-01-29 22:30:00',
  },
  {
    id: '5',
    level: 'info',
    message: '数据库备份完成，备份大小: 2.3GB',
    service: 'Backup Service',
    time: '2025-01-29 03:00:00',
  },
];

export const MonitorPage = () => {
  const [lastRefresh, setLastRefresh] = useState(new Date().toLocaleString());
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setLastRefresh(new Date().toLocaleString());
      setIsRefreshing(false);
    }, 1000);
  };

  // 自动刷新
  useEffect(() => {
    const interval = setInterval(() => {
      setLastRefresh(new Date().toLocaleString());
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'degraded':
        return <WarningOutlined style={{ color: '#faad14' }} />;
      case 'down':
        return <CloseCircleOutlined style={{ color: '#f5222d' }} />;
      default:
        return <SyncOutlined spin />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'success';
      case 'degraded':
        return 'warning';
      case 'down':
        return 'error';
      default:
        return 'default';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'healthy':
        return '正常';
      case 'degraded':
        return '降级';
      case 'down':
        return '宕机';
      default:
        return '检测中';
    }
  };

  const getMetricStatus = (metric: ISystemMetric) => {
    const percent = (metric.value / metric.max) * 100;
    if (percent >= 90) return 'exception';
    if (percent >= 70) return 'active';
    return 'success';
  };

  const getAlertIcon = (level: string) => {
    switch (level) {
      case 'error':
        return <CloseCircleOutlined style={{ color: '#f5222d' }} />;
      case 'warning':
        return <WarningOutlined style={{ color: '#faad14' }} />;
      default:
        return <CheckCircleOutlined style={{ color: '#1890ff' }} />;
    }
  };

  const serviceColumns = [
    {
      title: '服务',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => (
        <Space>
          <CloudServerOutlined />
          <Text strong>{name}</Text>
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag icon={getStatusIcon(status)} color={getStatusColor(status)}>
          {getStatusLabel(status)}
        </Tag>
      ),
    },
    {
      title: '延迟',
      dataIndex: 'latency',
      key: 'latency',
      render: (latency: number) => (
        <span style={{
          color: latency > 500 ? '#f5222d' : latency > 200 ? '#faad14' : '#52c41a'
        }}>
          {latency} ms
        </span>
      ),
    },
    {
      title: '可用率',
      dataIndex: 'uptime',
      key: 'uptime',
      render: (uptime: string) => <Text>{uptime}</Text>,
    },
    {
      title: '最后检测',
      dataIndex: 'lastCheck',
      key: 'lastCheck',
      render: (time: string) => <Text type="secondary">{time}</Text>,
    },
  ];

  // 计算整体系统状态
  const healthyCount = mockServices.filter(s => s.status === 'healthy').length;
  const totalCount = mockServices.length;
  const overallStatus = healthyCount === totalCount ? 'healthy' : healthyCount >= totalCount - 1 ? 'degraded' : 'down';

  return (
    <div style={{ padding: 24 }}>
      {/* 页面标题 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>系统监控</Title>
        <Space>
          <Text type="secondary">最后刷新: {lastRefresh}</Text>
          <Button
            icon={<ReloadOutlined spin={isRefreshing} />}
            onClick={handleRefresh}
            loading={isRefreshing}
          >
            刷新
          </Button>
        </Space>
      </div>

      {/* 系统整体状态 */}
      {overallStatus !== 'healthy' && (
        <Alert
          message="系统状态异常"
          description={`当前有 ${totalCount - healthyCount} 个服务处于非正常状态，请检查。`}
          type={overallStatus === 'degraded' ? 'warning' : 'error'}
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      {/* 概览统计 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="服务状态"
              value={healthyCount}
              suffix={`/ ${totalCount}`}
              valueStyle={{ color: overallStatus === 'healthy' ? '#52c41a' : '#faad14' }}
              prefix={getStatusIcon(overallStatus)}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="平均响应时间"
              value={Math.round(mockServices.reduce((sum, s) => sum + s.latency, 0) / totalCount)}
              suffix="ms"
              valueStyle={{ color: '#1890ff' }}
              prefix={<ThunderboltOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="今日请求量"
              value={1256789}
              valueStyle={{ color: '#722ed1' }}
              prefix={<ApiOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="今日错误率"
              value={0.02}
              precision={2}
              suffix="%"
              valueStyle={{ color: '#52c41a' }}
              prefix={<DatabaseOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        {/* 服务状态表格 */}
        <Col span={14}>
          <Card title="服务状态" style={{ marginBottom: 24 }}>
            <Table
              dataSource={mockServices}
              columns={serviceColumns}
              rowKey="name"
              pagination={false}
              size="small"
            />
          </Card>

          {/* 系统指标 */}
          <Card title="系统资源">
            <Row gutter={[16, 16]}>
              {mockMetrics.map((metric) => (
                <Col span={8} key={metric.name}>
                  <Card size="small">
                    <Text type="secondary">{metric.name}</Text>
                    <div style={{ marginTop: 8 }}>
                      <Progress
                        percent={Math.round((metric.value / metric.max) * 100)}
                        status={getMetricStatus(metric)}
                        size="small"
                      />
                      <Text>
                        {metric.value} / {metric.max} {metric.unit}
                      </Text>
                    </div>
                  </Card>
                </Col>
              ))}
            </Row>
          </Card>
        </Col>

        {/* 告警日志 */}
        <Col span={10}>
          <Card title="最近告警" style={{ height: '100%' }}>
            <Timeline
              items={mockAlerts.map((alert) => ({
                dot: getAlertIcon(alert.level),
                children: (
                  <div>
                    <Text strong>{alert.message}</Text>
                    <br />
                    <Space size="small">
                      <Tag>{alert.service}</Tag>
                      <Text type="secondary" style={{ fontSize: 12 }}>{alert.time}</Text>
                    </Space>
                  </div>
                ),
              }))}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};
