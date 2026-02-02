/**
 * 紧急开关页面
 * 全局/策略/用户级别的信号控制
 * 已对接真实 API:
 * - GET /admin/signals/kill-switch
 * - POST /admin/signals/kill-switch/global
 * - POST /admin/signals/kill-switch/strategy/:id
 * - POST /admin/signals/kill-switch/strategies/batch
 * - POST /admin/signals/kill-switch/user/:id
 * - GET /admin/signals/kill-switch/users/search
 * - GET /admin/signals/kill-switch/logs
 */
import {
  Card,
  Row,
  Col,
  Switch,
  Button,
  Table,
  Tag,
  Space,
  Typography,
  Alert,
  Modal,
  Input,
  Select,
  Divider,
  Timeline,
  Statistic,
  Spin,
} from 'antd';
import {
  StopOutlined,
  PlayCircleOutlined,
  ExclamationCircleOutlined,
  HistoryOutlined,
  UserOutlined,
  RocketOutlined,
  ThunderboltOutlined,
  WarningOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useState, useEffect, useCallback } from 'react';
import { api } from '../../lib/api';
import { useMessage } from '../../hooks';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { confirm } = Modal;

interface IStrategySwitch {
  id: string;
  name: string;
  isActive: boolean;
  subscriberCount: number;
  lastSignal: string | null;
  stoppedAt?: string;
  stoppedBy?: string;
  reason?: string;
}

interface IUserSwitch {
  userId: string;
  email: string;
  username: string;
  status: 'active' | 'stopped';
  stoppedAt?: string;
  stoppedBy?: string;
  reason?: string;
}

interface ISwitchLog {
  id: string;
  type: 'global' | 'strategy' | 'user' | 'batch_strategy';
  target: string;
  action: 'stop' | 'resume';
  operator: string;
  reason: string;
  time: string;
}

interface IKillSwitchOverview {
  global: {
    enabled: boolean;
    lastUpdated: string;
    updatedBy: string | null;
  };
  stats: {
    totalStrategies: number;
    runningStrategies: number;
    stoppedStrategies: number;
    stoppedUsers: number;
    affectedUsers: number;
  };
  strategies: IStrategySwitch[];
  stoppedUsers: IUserSwitch[];
  recentLogs: ISwitchLog[];
}

export const KillSwitchPage = () => {
  const message = useMessage();
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<IKillSwitchOverview | null>(null);
  const [stopModalVisible, setStopModalVisible] = useState(false);
  const [stopTarget, setStopTarget] = useState<{ type: string; id: string; name: string } | null>(null);
  const [stopReason, setStopReason] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<IUserSwitch[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // 加载数据
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ code: number; data: IKillSwitchOverview }>('/admin/signals/kill-switch');
      setOverview(res.data || res);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '加载数据失败';
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 全局开关切换
  const handleGlobalSwitch = (checked: boolean) => {
    const action = checked ? '启用' : '停止';
    confirm({
      title: `确认${action}全局信号？`,
      icon: <ExclamationCircleOutlined />,
      content: checked
        ? '启用后，所有策略将恢复信号发送'
        : '停止后，所有策略将立即停止信号发送，用户将无法收到任何交易信号',
      okText: '确认',
      cancelText: '取消',
      okButtonProps: { danger: !checked },
      async onOk() {
        try {
          await api.post('/admin/signals/kill-switch/global', {
            enabled: checked,
            reason: checked ? '管理员恢复全局信号' : '管理员停止全局信号',
          });
          message.success(`全局信号已${action}`);
          fetchData();
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : '操作失败';
          message.error(errorMessage);
        }
      },
    });
  };

  // 策略开关切换
  const handleStrategySwitch = (strategy: IStrategySwitch) => {
    if (strategy.isActive) {
      setStopTarget({ type: 'strategy', id: strategy.id, name: strategy.name });
      setStopModalVisible(true);
    } else {
      confirm({
        title: `确认恢复策略 "${strategy.name}"？`,
        icon: <PlayCircleOutlined />,
        content: '恢复后该策略将继续发送信号',
        okText: '确认恢复',
        cancelText: '取消',
        async onOk() {
          try {
            await api.post(`/admin/signals/kill-switch/strategy/${strategy.id}`, {
              enabled: true,
              reason: '管理员恢复策略',
            });
            message.success(`策略 "${strategy.name}" 已恢复`);
            fetchData();
          } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : '操作失败';
            message.error(errorMessage);
          }
        },
      });
    }
  };

  // 用户开关切换
  const handleUserSwitch = (user: IUserSwitch) => {
    if (user.status === 'active') {
      setStopTarget({ type: 'user', id: user.userId, name: user.email });
      setStopModalVisible(true);
    } else {
      confirm({
        title: `确认恢复用户 "${user.username}"？`,
        icon: <PlayCircleOutlined />,
        content: '恢复后该用户将继续接收交易信号',
        okText: '确认恢复',
        cancelText: '取消',
        async onOk() {
          try {
            await api.post(`/admin/signals/kill-switch/user/${user.userId}`, {
              enabled: true,
              reason: '管理员恢复用户信号',
            });
            message.success(`用户 "${user.username}" 已恢复`);
            fetchData();
          } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : '操作失败';
            message.error(errorMessage);
          }
        },
      });
    }
  };

  // 确认停止
  const handleConfirmStop = async () => {
    if (!stopTarget || !stopReason.trim()) {
      message.error('请填写停止原因');
      return;
    }

    try {
      if (stopTarget.type === 'strategy') {
        await api.post(`/admin/signals/kill-switch/strategy/${stopTarget.id}`, {
          enabled: false,
          reason: stopReason,
        });
      } else if (stopTarget.type === 'user') {
        await api.post(`/admin/signals/kill-switch/user/${stopTarget.id}`, {
          enabled: false,
          reason: stopReason,
        });
      }

      message.success(`已停止: ${stopTarget.name}`);
      setStopModalVisible(false);
      setStopTarget(null);
      setStopReason('');
      fetchData();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '操作失败';
      message.error(errorMessage);
    }
  };

  // 一键停止所有策略
  const handleStopAll = () => {
    confirm({
      title: '确认停止所有策略？',
      icon: <ExclamationCircleOutlined style={{ color: '#f5222d' }} />,
      content: '这将立即停止所有策略的信号发送，所有用户将无法收到交易信号',
      okText: '确认停止',
      okButtonProps: { danger: true },
      cancelText: '取消',
      async onOk() {
        try {
          await api.post('/admin/signals/kill-switch/strategies/batch', {
            enabled: false,
            reason: '一键停止所有策略',
          });
          message.success('已停止所有策略');
          fetchData();
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : '操作失败';
          message.error(errorMessage);
        }
      },
    });
  };

  // 一键恢复所有策略
  const handleResumeAll = () => {
    confirm({
      title: '确认恢复所有策略？',
      icon: <PlayCircleOutlined style={{ color: '#52c41a' }} />,
      content: '这将恢复所有已停止策略的信号发送',
      okText: '确认恢复',
      cancelText: '取消',
      async onOk() {
        try {
          await api.post('/admin/signals/kill-switch/strategies/batch', {
            enabled: true,
            reason: '一键恢复所有策略',
          });
          message.success('已恢复所有策略');
          fetchData();
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : '操作失败';
          message.error(errorMessage);
        }
      },
    });
  };

  // 搜索用户
  const handleSearchUser = async (keyword: string) => {
    if (!keyword || keyword.length < 2) {
      setUserSearchResults([]);
      return;
    }
    setSearchLoading(true);
    try {
      const res = await api.get<{ code: number; data: IUserSwitch[] }>(
        `/admin/signals/kill-switch/users/search?keyword=${encodeURIComponent(keyword)}`
      );
      setUserSearchResults(res.data || res || []);
    } catch {
      setUserSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const strategyColumns = [
    { title: '策略ID', dataIndex: 'id', key: 'id', width: 100, render: (id: string) => <Text copyable={{ text: id }}>{id.slice(0, 8)}...</Text> },
    { title: '策略名称', dataIndex: 'name', key: 'name', render: (name: string) => <Text strong>{name}</Text> },
    { title: '订阅人数', dataIndex: 'subscriberCount', key: 'subscriberCount' },
    { title: '最后信号', dataIndex: 'lastSignal', key: 'lastSignal', render: (t: string | null) => t ? <Text type="secondary">{new Date(t).toLocaleString('zh-CN')}</Text> : '-' },
    {
      title: '状态',
      key: 'status',
      render: (_: unknown, record: IStrategySwitch) => (
        <Space direction="vertical" size={0}>
          <Tag color={record.isActive ? 'success' : 'error'}>
            {record.isActive ? '运行中' : '已停止'}
          </Tag>
          {!record.isActive && record.stoppedAt && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.stoppedBy} 于 {new Date(record.stoppedAt).toLocaleString('zh-CN')}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: IStrategySwitch) => (
        <Switch
          checked={record.isActive}
          onChange={() => handleStrategySwitch(record)}
          checkedChildren="运行"
          unCheckedChildren="停止"
        />
      ),
    },
  ];

  const userColumns = [
    { title: '用户ID', dataIndex: 'userId', key: 'userId', width: 100, render: (id: string) => <Text copyable={{ text: id }}>{id.slice(0, 8)}...</Text> },
    { title: '邮箱', dataIndex: 'email', key: 'email' },
    { title: '用户名', dataIndex: 'username', key: 'username' },
    {
      title: '状态',
      key: 'status',
      render: (_: unknown, record: IUserSwitch) => (
        <Space direction="vertical" size={0}>
          <Tag color={record.status === 'active' ? 'success' : 'error'}>
            {record.status === 'active' ? '正常' : '已停止'}
          </Tag>
          {record.status === 'stopped' && record.reason && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              原因: {record.reason}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: IUserSwitch) => (
        <Switch
          checked={record.status === 'active'}
          onChange={() => handleUserSwitch(record)}
          checkedChildren="正常"
          unCheckedChildren="停止"
        />
      ),
    },
  ];

  if (loading || !overview) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  const { global, stats, strategies, stoppedUsers, recentLogs } = overview;

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>紧急开关</Title>
        <Button icon={<ReloadOutlined spin={loading} />} onClick={fetchData}>刷新</Button>
      </div>

      {/* 全局状态警告 */}
      {!global.enabled && (
        <Alert
          message="全局信号已停止"
          description="所有策略的信号发送已被暂停，用户无法收到任何交易信号"
          type="error"
          showIcon
          icon={<StopOutlined />}
          style={{ marginTop: 16, marginBottom: 16 }}
          action={
            <Button type="primary" onClick={() => handleGlobalSwitch(true)}>
              恢复全局信号
            </Button>
          }
        />
      )}

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginTop: 24, marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="全局开关"
              value={global.enabled ? '开启' : '关闭'}
              valueStyle={{ color: global.enabled ? '#52c41a' : '#f5222d' }}
              prefix={global.enabled ? <ThunderboltOutlined /> : <StopOutlined />}
            />
            <div style={{ marginTop: 16 }}>
              <Switch
                checked={global.enabled}
                onChange={handleGlobalSwitch}
                checkedChildren="开启"
                unCheckedChildren="关闭"
                style={{ transform: 'scale(1.2)' }}
              />
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="运行中策略"
              value={stats.runningStrategies}
              suffix={`/ ${stats.totalStrategies}`}
              valueStyle={{ color: '#52c41a' }}
              prefix={<RocketOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已停止策略"
              value={stats.stoppedStrategies}
              valueStyle={{ color: stats.stoppedStrategies > 0 ? '#faad14' : '#52c41a' }}
              prefix={<WarningOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="受影响用户"
              value={stats.affectedUsers}
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* 快捷操作 */}
      <Card title="快捷操作" style={{ marginBottom: 24 }}>
        <Space>
          <Button
            danger
            icon={<StopOutlined />}
            onClick={handleStopAll}
            disabled={stats.runningStrategies === 0}
          >
            一键停止所有策略
          </Button>
          <Button
            icon={<PlayCircleOutlined />}
            onClick={handleResumeAll}
            disabled={stats.stoppedStrategies === 0}
          >
            一键恢复所有策略
          </Button>
        </Space>
      </Card>

      {/* 策略级控制 */}
      <Card
        title={
          <Space>
            <RocketOutlined />
            <span>策略级控制</span>
          </Space>
        }
        style={{ marginBottom: 24 }}
      >
        <Table
          dataSource={strategies}
          columns={strategyColumns}
          rowKey="id"
          pagination={false}
          locale={{ emptyText: '暂无策略' }}
        />
      </Card>

      {/* 用户级控制 */}
      <Card
        title={
          <Space>
            <UserOutlined />
            <span>用户级控制</span>
          </Space>
        }
        extra={
          <Select
            placeholder="搜索用户"
            showSearch
            style={{ width: 250 }}
            loading={searchLoading}
            onSearch={handleSearchUser}
            filterOption={false}
            notFoundContent={searchLoading ? <Spin size="small" /> : '无匹配用户'}
            options={userSearchResults.map(u => ({
              value: u.userId,
              label: `${u.email} (${u.username})`,
              user: u,
            }))}
            onSelect={(_, option: any) => {
              if (option.user) {
                handleUserSwitch(option.user);
              }
            }}
          />
        }
        style={{ marginBottom: 24 }}
      >
        <Table
          dataSource={stoppedUsers}
          columns={userColumns}
          rowKey="userId"
          pagination={{ pageSize: 10 }}
          locale={{ emptyText: '暂无被停止的用户' }}
        />
      </Card>

      {/* 操作日志 */}
      <Card
        title={
          <Space>
            <HistoryOutlined />
            <span>操作日志</span>
          </Space>
        }
      >
        {recentLogs.length > 0 ? (
          <Timeline
            items={recentLogs.map(log => ({
              color: log.action === 'stop' ? 'red' : 'green',
              children: (
                <div>
                  <Text strong>
                    {log.action === 'stop' ? '停止' : '恢复'}
                    {log.type === 'global' ? ' 全局信号' :
                     log.type === 'batch_strategy' ? ` ${log.target}` :
                     log.type === 'strategy' ? ` 策略: ${log.target}` :
                     ` 用户: ${log.target}`}
                  </Text>
                  <br />
                  <Text type="secondary">原因: {log.reason}</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    操作人: {log.operator} | {new Date(log.time).toLocaleString('zh-CN')}
                  </Text>
                </div>
              ),
            }))}
          />
        ) : (
          <Text type="secondary">暂无操作日志</Text>
        )}
      </Card>

      {/* 停止确认弹窗 */}
      <Modal
        title={
          <Space>
            <ExclamationCircleOutlined style={{ color: '#faad14' }} />
            <span>确认停止</span>
          </Space>
        }
        open={stopModalVisible}
        onOk={handleConfirmStop}
        onCancel={() => {
          setStopModalVisible(false);
          setStopTarget(null);
          setStopReason('');
        }}
        okText="确认停止"
        okButtonProps={{ danger: true }}
        cancelText="取消"
      >
        <p>
          确认停止 <Text strong>{stopTarget?.name}</Text>？
        </p>
        <Divider />
        <div style={{ marginBottom: 8 }}>
          <Text>停止原因 (必填):</Text>
        </div>
        <TextArea
          rows={3}
          value={stopReason}
          onChange={(e) => setStopReason(e.target.value)}
          placeholder="请输入停止原因，便于后续审计"
        />
      </Modal>
    </div>
  );
};
