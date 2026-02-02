/**
 * 信号监控页面
 * 连接真实后端 API
 */
import { useState, useEffect, useCallback } from 'react';
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
  Typography,
  Badge,
  Progress,
  Tooltip,
  Spin,
} from 'antd';
import { useMessage, useModal } from '../../hooks';
import {
  ThunderboltOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  ReloadOutlined,
  StopOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { adminApi } from '../../lib/admin-api';

const { Text } = Typography;

interface ISignal {
  id: string;
  strategyId: string;
  strategyName: string;
  symbol: string;
  side: string;
  price: string;
  subscriberCount: number;
  executedCount: number;
  failedCount: number;
  distributedAt?: string;
  createdAt: string;
  statusCounts: Record<string, number>;
}

interface IStrategyStatus {
  id: string;
  name: string;
  isActive: boolean;
  subscribers: number;
  todaySignals: number;
  lastSignalAt?: string;
}

interface IStats {
  todaySignals: number;
  totalExecutions: number;
  successExecutions: number;
  successRate: string;
  runningStrategies: number;
  errorStrategies: number;
}

export const SignalsPage = () => {
  const message = useMessage();
  const modal = useModal();
  const [signals, setSignals] = useState<ISignal[]>([]);
  const [strategyStatus, setStrategyStatus] = useState<IStrategyStatus[]>([]);
  const [stats, setStats] = useState<IStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [globalSwitch, setGlobalSwitch] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshTime, setRefreshTime] = useState(new Date().toLocaleTimeString());
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);

  // 加载信号列表
  const loadSignals = useCallback(async () => {
    try {
      const response = await adminApi.get<{ items: ISignal[]; total: number }>(`/admin/signals?page=${page}&limit=${pageSize}`);
      if (response.data.code === 0) {
        const data = response.data.data as { items: ISignal[]; total: number };
        setSignals(data?.items || []);
        setTotal(data?.total || 0);
      }
    } catch (error) {
      console.error('加载信号列表失败:', error);
    }
  }, [page, pageSize]);

  // 加载统计数据
  const loadStats = useCallback(async () => {
    try {
      const response = await adminApi.get<IStats>('/admin/signals/stats');
      if (response.data.code === 0) {
        setStats(response.data.data as IStats);
      }
    } catch (error) {
      console.error('加载统计数据失败:', error);
    }
  }, []);

  // 加载策略状态
  const loadStrategyStatus = useCallback(async () => {
    try {
      const response = await adminApi.get<IStrategyStatus[]>('/admin/signals/strategy-status');
      if (response.data.code === 0) {
        setStrategyStatus((response.data.data as IStrategyStatus[]) || []);
      }
    } catch (error) {
      console.error('加载策略状态失败:', error);
    }
  }, []);

  // 刷新所有数据（showLoading: 是否显示加载状态）
  const refreshAll = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setLoading(true);
    }
    await Promise.all([loadSignals(), loadStats(), loadStrategyStatus()]);
    setRefreshTime(new Date().toLocaleTimeString());
    if (showLoading) {
      setLoading(false);
    }
  }, [loadSignals, loadStats, loadStrategyStatus]);

  useEffect(() => {
    refreshAll(true); // 首次加载显示 loading
  }, [refreshAll]);

  // 自动刷新（静默刷新，不显示 loading）
  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => {
      void refreshAll(false); // 静默刷新
    }, 30000); // 30秒刷新一次
    return () => clearInterval(timer);
  }, [autoRefresh, refreshAll]);

  // 处理刷新按钮点击
  const handleRefreshClick = () => {
    void refreshAll(true);
  };

  const handleGlobalSwitch = (checked: boolean) => {
    modal.confirm({
      title: (
        <span style={{ color: checked ? '#52c41a' : '#ff4d4f' }}>
          {checked ? '启动信号系统' : '紧急停止信号系统'}
        </span>
      ),
      icon: <ExclamationCircleOutlined style={{ color: checked ? '#52c41a' : '#ff4d4f' }} />,
      content: (
        <span style={{ color: checked ? '#52c41a' : '#ff4d4f' }}>
          {checked
            ? '确定要启动信号分发系统吗？所有策略将恢复信号发送。'
            : '警告：这将立即停止所有策略的信号分发！用户将无法收到任何交易信号。'}
        </span>
      ),
      okText: checked ? '确认启动' : '紧急停止',
      okButtonProps: { danger: !checked },
      cancelText: '取消',
      onOk() {
        setGlobalSwitch(checked);
        message.success(checked ? '信号系统已启动' : '信号系统已停止');
      },
    });
  };

  const handleStrategyToggle = async (strategyId: string) => {
    const strategy = strategyStatus.find((s) => s.id === strategyId);
    if (!strategy) return;

    try {
      await adminApi.put(`/admin/strategies/${strategyId}`, {
        isActive: !strategy.isActive,
      });
      message.success(strategy.isActive ? '策略已暂停' : '策略已启动');
      loadStrategyStatus();
    } catch (error: any) {
      message.error(error.response?.data?.message || '操作失败');
    }
  };

  const formatTimeAgo = (dateStr?: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins}分钟前`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}小时前`;
    return date.toLocaleDateString();
  };

  const signalColumns = [
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date: string) => new Date(date).toLocaleString(),
    },
    {
      title: '策略',
      dataIndex: 'strategyName',
      key: 'strategyName',
    },
    {
      title: '交易对',
      dataIndex: 'symbol',
      key: 'symbol',
      width: 100,
    },
    {
      title: '方向',
      dataIndex: 'side',
      key: 'side',
      width: 80,
      render: (side: string) => (
        <Tag color={side === 'buy' ? 'green' : 'red'}>
          {side === 'buy' ? '买入' : '卖出'}
        </Tag>
      ),
    },
    {
      title: '价格',
      dataIndex: 'price',
      key: 'price',
      width: 120,
      render: (price: string) => `$${parseFloat(price).toLocaleString()}`,
    },
    {
      title: '执行进度',
      key: 'progress',
      width: 150,
      render: (_: unknown, record: ISignal) => {
        const total = record.subscriberCount || 1;
        const executed = record.executedCount || 0;
        const percent = Math.round((executed / total) * 100);
        const hasFailed = record.failedCount > 0;
        return (
          <Tooltip title={`成功: ${executed}, 失败: ${record.failedCount}, 总数: ${total}`}>
            <Progress
              percent={percent}
              size="small"
              status={hasFailed ? 'exception' : undefined}
            />
          </Tooltip>
        );
      },
    },
    {
      title: '状态',
      key: 'status',
      width: 100,
      render: (_: unknown, record: ISignal) => {
        const pending = record.statusCounts?.pending || 0;
        const executing = record.statusCounts?.executing || 0;
        const success = record.statusCounts?.success || 0;
        const failed = record.statusCounts?.failed || 0;

        if (pending > 0 || executing > 0) {
          return <Tag color="processing" icon={<ThunderboltOutlined />}>执行中</Tag>;
        }
        if (failed > 0 && success === 0) {
          return <Tag color="error" icon={<WarningOutlined />}>失败</Tag>;
        }
        return <Tag color="success" icon={<CheckCircleOutlined />}>已完成</Tag>;
      },
    },
  ];

  const runningStrategies = strategyStatus.filter((s) => s.isActive).length;
  const errorStrategies = strategyStatus.filter((s) => !s.isActive).length;

  return (
    <List>
      <Spin spinning={loading}>
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
                    onClick={handleRefreshClick}
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
                  value={stats?.todaySignals || 0}
                  prefix={<ThunderboltOutlined />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="执行成功率"
                  value={stats?.successRate || '100'}
                  suffix="%"
                  valueStyle={{ color: parseFloat(stats?.successRate || '100') >= 90 ? '#52c41a' : '#faad14' }}
                  prefix={<CheckCircleOutlined />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="运行中策略"
                  value={runningStrategies}
                  suffix={`/ ${strategyStatus.length}`}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="暂停策略"
                  value={errorStrategies}
                  valueStyle={{ color: errorStrategies > 0 ? '#faad14' : '#52c41a' }}
                  prefix={<WarningOutlined />}
                />
              </Card>
            </Col>
          </Row>

          {/* 策略状态 */}
          <Card title="策略运行状态">
            <Row gutter={16}>
              {strategyStatus.slice(0, 6).map((strategy) => (
                <Col span={8} key={strategy.id} style={{ marginBottom: 16 }}>
                  <Card
                    size="small"
                    style={{
                      borderColor: strategy.isActive ? '#52c41a' : '#faad14',
                    }}
                  >
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Text strong>{strategy.name}</Text>
                        <Tag color={strategy.isActive ? 'green' : 'orange'}>
                          {strategy.isActive ? '运行中' : '已暂停'}
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
                          <Text type="secondary">最后信号</Text>
                          <div>{formatTimeAgo(strategy.lastSignalAt)}</div>
                        </Col>
                      </Row>
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <Button
                          size="small"
                          type={strategy.isActive ? 'default' : 'primary'}
                          icon={strategy.isActive ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                          onClick={() => handleStrategyToggle(strategy.id)}
                          disabled={!globalSwitch}
                        >
                          {strategy.isActive ? '暂停' : '启动'}
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
              scroll={{ x: 900 }}
              pagination={{
                current: page,
                pageSize,
                total,
                showTotal: (t) => `共 ${t} 条`,
                onChange: (p) => setPage(p),
              }}
            />
          </Card>
        </Space>
      </Spin>
    </List>
  );
};
