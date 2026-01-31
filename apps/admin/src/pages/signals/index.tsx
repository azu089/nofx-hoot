/**
 * 信号监控页面
 * 实时信号查看、紧急开关、策略状态监控
 */
import { useState, useEffect } from 'react';
import { List } from '@refinedev/antd';
import {
  Card,
  Table,
  Tag,
  Space,
  Button,
  Switch,
  Statistic,
  Row,
  Col,
  Alert,
  Modal,
  Typography,
  Badge,
  Progress,
  Tooltip,
} from 'antd';
import {
  ThunderboltOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ReloadOutlined,
  StopOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';

const { Text } = Typography;

interface ISignal {
  id: string;
  strategyId: string;
  strategyName: string;
  type: 'buy' | 'sell';
  pair: string;
  price: string;
  amount: string;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  time: string;
  executedCount: number;
  totalSubscribers: number;
}

interface IStrategyStatus {
  id: string;
  name: string;
  status: 'running' | 'paused' | 'error';
  subscribers: number;
  todaySignals: number;
  successRate: number;
  lastSignal: string;
}

// 模拟实时信号数据
const mockSignals: ISignal[] = [
  {
    id: '1',
    strategyId: '1',
    strategyName: 'AI量化策略Alpha',
    type: 'buy',
    pair: 'BTC/USDT',
    price: '42150.00',
    amount: '0.05',
    status: 'executing',
    time: '2025-01-30 14:32:15',
    executedCount: 120,
    totalSubscribers: 156,
  },
  {
    id: '2',
    strategyId: '2',
    strategyName: '稳健网格策略',
    type: 'sell',
    pair: 'ETH/USDT',
    price: '2350.00',
    amount: '0.5',
    status: 'completed',
    time: '2025-01-30 14:30:42',
    executedCount: 89,
    totalSubscribers: 89,
  },
  {
    id: '3',
    strategyId: '1',
    strategyName: 'AI量化策略Alpha',
    type: 'sell',
    pair: 'BTC/USDT',
    price: '42380.00',
    amount: '0.05',
    status: 'completed',
    time: '2025-01-30 14:28:18',
    executedCount: 156,
    totalSubscribers: 156,
  },
  {
    id: '4',
    strategyId: '3',
    strategyName: '趋势追踪Pro',
    type: 'buy',
    pair: 'BTC/USDT',
    price: '42100.00',
    amount: '0.03',
    status: 'failed',
    time: '2025-01-30 14:25:00',
    executedCount: 12,
    totalSubscribers: 45,
  },
];

// 模拟策略状态数据
const mockStrategyStatus: IStrategyStatus[] = [
  {
    id: '1',
    name: 'AI量化策略Alpha',
    status: 'running',
    subscribers: 156,
    todaySignals: 8,
    successRate: 98.5,
    lastSignal: '2分钟前',
  },
  {
    id: '2',
    name: '稳健网格策略',
    status: 'running',
    subscribers: 89,
    todaySignals: 12,
    successRate: 100,
    lastSignal: '4分钟前',
  },
  {
    id: '3',
    name: '趋势追踪Pro',
    status: 'error',
    subscribers: 45,
    todaySignals: 3,
    successRate: 66.7,
    lastSignal: '9分钟前',
  },
];

export const SignalsPage = () => {
  const [signals] = useState<ISignal[]>(mockSignals);
  const [strategyStatus, setStrategyStatus] = useState<IStrategyStatus[]>(mockStrategyStatus);
  const [globalSwitch, setGlobalSwitch] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshTime, setRefreshTime] = useState(new Date().toLocaleTimeString());

  // 模拟自动刷新
  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => {
      setRefreshTime(new Date().toLocaleTimeString());
    }, 5000);
    return () => clearInterval(timer);
  }, [autoRefresh]);

  const handleGlobalSwitch = (checked: boolean) => {
    Modal.confirm({
      title: checked ? '启动信号系统' : '紧急停止信号系统',
      icon: <ExclamationCircleOutlined />,
      content: checked
        ? '确定要启动信号分发系统吗？所有策略将恢复信号发送。'
        : '警告：这将立即停止所有策略的信号分发！用户将无法收到任何交易信号。',
      okText: checked ? '确认启动' : '紧急停止',
      okButtonProps: { danger: !checked },
      cancelText: '取消',
      onOk() {
        setGlobalSwitch(checked);
        if (!checked) {
          setStrategyStatus(
            strategyStatus.map((s) => ({ ...s, status: 'paused' as const }))
          );
        }
      },
    });
  };

  const handleStrategyToggle = (strategyId: string) => {
    const strategy = strategyStatus.find((s) => s.id === strategyId);
    if (!strategy) return;

    const newStatus = strategy.status === 'running' ? 'paused' : 'running';
    setStrategyStatus(
      strategyStatus.map((s) =>
        s.id === strategyId ? { ...s, status: newStatus as 'running' | 'paused' | 'error' } : s
      )
    );
  };

  const signalColumns = [
    {
      title: '时间',
      dataIndex: 'time',
      key: 'time',
      width: 180,
    },
    {
      title: '策略',
      dataIndex: 'strategyName',
      key: 'strategyName',
    },
    {
      title: '交易对',
      dataIndex: 'pair',
      key: 'pair',
      width: 100,
    },
    {
      title: '方向',
      dataIndex: 'type',
      key: 'type',
      width: 80,
      render: (type: string) => (
        <Tag color={type === 'buy' ? 'green' : 'red'}>
          {type === 'buy' ? '买入' : '卖出'}
        </Tag>
      ),
    },
    {
      title: '价格',
      dataIndex: 'price',
      key: 'price',
      width: 120,
      render: (price: string) => `$${price}`,
    },
    {
      title: '数量',
      dataIndex: 'amount',
      key: 'amount',
      width: 100,
    },
    {
      title: '执行进度',
      key: 'progress',
      width: 150,
      render: (_: unknown, record: ISignal) => {
        const percent = Math.round(
          (record.executedCount / record.totalSubscribers) * 100
        );
        return (
          <Tooltip title={`${record.executedCount}/${record.totalSubscribers} 用户`}>
            <Progress
              percent={percent}
              size="small"
              status={record.status === 'failed' ? 'exception' : undefined}
            />
          </Tooltip>
        );
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const config = {
          pending: { color: 'default', icon: <ClockCircleOutlined />, text: '待执行' },
          executing: { color: 'processing', icon: <ThunderboltOutlined />, text: '执行中' },
          completed: { color: 'success', icon: <CheckCircleOutlined />, text: '已完成' },
          failed: { color: 'error', icon: <WarningOutlined />, text: '失败' },
        };
        const { color, icon, text } = config[status as keyof typeof config];
        return (
          <Tag color={color} icon={icon}>
            {text}
          </Tag>
        );
      },
    },
  ];

  return (
    <List>
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {/* 全局控制面板 */}
        <Card>
          <Row gutter={24} align="middle">
            <Col span={8}>
              <Space size="large">
                <div>
                  <Text type="secondary">信号系统状态</Text>
                  <div style={{ marginTop: 8 }}>
                    {globalSwitch ? (
                      <Badge status="processing" text={<Text strong style={{ color: '#52c41a' }}>运行中</Text>} />
                    ) : (
                      <Badge status="error" text={<Text strong style={{ color: '#f5222d' }}>已停止</Text>} />
                    )}
                  </div>
                </div>
                <Switch
                  checked={globalSwitch}
                  onChange={handleGlobalSwitch}
                  checkedChildren="运行"
                  unCheckedChildren="停止"
                  style={{ marginLeft: 16 }}
                />
              </Space>
            </Col>
            <Col span={8}>
              <Space>
                <Text type="secondary">自动刷新</Text>
                <Switch
                  checked={autoRefresh}
                  onChange={setAutoRefresh}
                  size="small"
                />
                <Text type="secondary" style={{ marginLeft: 8 }}>
                  最后更新: {refreshTime}
                </Text>
                <Button
                  icon={<ReloadOutlined />}
                  size="small"
                  onClick={() => setRefreshTime(new Date().toLocaleTimeString())}
                >
                  刷新
                </Button>
              </Space>
            </Col>
            <Col span={8} style={{ textAlign: 'right' }}>
              <Button
                danger
                icon={<StopOutlined />}
                onClick={() => handleGlobalSwitch(false)}
                disabled={!globalSwitch}
              >
                紧急停止所有信号
              </Button>
            </Col>
          </Row>
        </Card>

        {/* 统计卡片 */}
        <Row gutter={16}>
          <Col span={6}>
            <Card>
              <Statistic
                title="今日信号总数"
                value={23}
                prefix={<ThunderboltOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="执行成功率"
                value={96.5}
                suffix="%"
                valueStyle={{ color: '#52c41a' }}
                prefix={<CheckCircleOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="运行中策略"
                value={strategyStatus.filter((s) => s.status === 'running').length}
                suffix={`/ ${strategyStatus.length}`}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="异常策略"
                value={strategyStatus.filter((s) => s.status === 'error').length}
                valueStyle={{
                  color:
                    strategyStatus.filter((s) => s.status === 'error').length > 0
                      ? '#f5222d'
                      : '#52c41a',
                }}
                prefix={<WarningOutlined />}
              />
            </Card>
          </Col>
        </Row>

        {/* 策略状态 */}
        <Card title="策略运行状态">
          <Row gutter={16}>
            {strategyStatus.map((strategy) => (
              <Col span={8} key={strategy.id}>
                <Card
                  size="small"
                  style={{
                    borderColor:
                      strategy.status === 'error'
                        ? '#f5222d'
                        : strategy.status === 'paused'
                        ? '#faad14'
                        : '#52c41a',
                  }}
                >
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text strong>{strategy.name}</Text>
                      <Tag
                        color={
                          strategy.status === 'running'
                            ? 'green'
                            : strategy.status === 'paused'
                            ? 'orange'
                            : 'red'
                        }
                      >
                        {strategy.status === 'running'
                          ? '运行中'
                          : strategy.status === 'paused'
                          ? '已暂停'
                          : '异常'}
                      </Tag>
                    </div>
                    <Row gutter={8}>
                      <Col span={8}>
                        <Text type="secondary">订阅用户</Text>
                        <div>{strategy.subscribers}</div>
                      </Col>
                      <Col span={8}>
                        <Text type="secondary">今日信号</Text>
                        <div>{strategy.todaySignals}</div>
                      </Col>
                      <Col span={8}>
                        <Text type="secondary">成功率</Text>
                        <div style={{ color: strategy.successRate >= 90 ? '#52c41a' : '#faad14' }}>
                          {strategy.successRate}%
                        </div>
                      </Col>
                    </Row>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text type="secondary">最后信号: {strategy.lastSignal}</Text>
                      <Button
                        size="small"
                        type={strategy.status === 'running' ? 'default' : 'primary'}
                        icon={strategy.status === 'running' ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                        onClick={() => handleStrategyToggle(strategy.id)}
                        disabled={!globalSwitch}
                      >
                        {strategy.status === 'running' ? '暂停' : '启动'}
                      </Button>
                    </div>
                  </Space>
                </Card>
              </Col>
            ))}
          </Row>
        </Card>

        {/* 实时信号列表 */}
        <Card title="实时信号记录">
          {!globalSwitch && (
            <Alert
              message="信号系统已停止"
              description="所有策略信号分发已暂停，请启动系统后恢复"
              type="error"
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}
          <Table
            dataSource={signals}
            columns={signalColumns}
            rowKey="id"
            pagination={{ pageSize: 10 }}
          />
        </Card>
      </Space>
    </List>
  );
};
