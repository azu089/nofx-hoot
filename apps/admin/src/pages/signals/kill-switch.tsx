/**
 * 紧急开关页面
 * 全局/策略/用户级别的信号控制
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
  message,
  Divider,
  Timeline,
  Statistic,
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
} from '@ant-design/icons';
import { useState } from 'react';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { confirm } = Modal;

interface IStrategySwitch {
  id: string;
  name: string;
  status: 'running' | 'stopped';
  subscribers: number;
  lastSignal: string;
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
  type: 'global' | 'strategy' | 'user';
  target: string;
  action: 'stop' | 'resume';
  operator: string;
  reason: string;
  time: string;
}

// 模拟数据
const mockStrategies: IStrategySwitch[] = [
  { id: 'S001', name: 'BTC 趋势追踪', status: 'running', subscribers: 156, lastSignal: '2025-01-30 14:25:00' },
  { id: 'S002', name: 'ETH 网格策略', status: 'running', subscribers: 89, lastSignal: '2025-01-30 14:20:00' },
  { id: 'S003', name: 'SOL 波段策略', status: 'stopped', subscribers: 45, lastSignal: '2025-01-30 10:00:00', stoppedAt: '2025-01-30 10:30:00', stoppedBy: 'admin', reason: '策略异常，紧急停止' },
  { id: 'S004', name: 'DOGE 高频策略', status: 'running', subscribers: 234, lastSignal: '2025-01-30 14:28:00' },
];

const mockUsers: IUserSwitch[] = [
  { userId: 'U001', email: 'user1@example.com', username: '张三', status: 'active' },
  { userId: 'U002', email: 'user2@example.com', username: '李四', status: 'stopped', stoppedAt: '2025-01-30 12:00:00', stoppedBy: 'admin', reason: '账户异常' },
];

const mockLogs: ISwitchLog[] = [
  { id: '1', type: 'strategy', target: 'SOL 波段策略', action: 'stop', operator: 'admin', reason: '策略异常，紧急停止', time: '2025-01-30 10:30:00' },
  { id: '2', type: 'user', target: 'user2@example.com', action: 'stop', operator: 'admin', reason: '账户异常', time: '2025-01-30 12:00:00' },
  { id: '3', type: 'global', target: '全局', action: 'stop', operator: 'admin', reason: '系统维护', time: '2025-01-29 22:00:00' },
  { id: '4', type: 'global', target: '全局', action: 'resume', operator: 'admin', reason: '维护完成', time: '2025-01-30 02:00:00' },
];

export const KillSwitchPage = () => {
  const [globalEnabled, setGlobalEnabled] = useState(true);
  const [strategies, setStrategies] = useState(mockStrategies);
  const [users, setUsers] = useState(mockUsers);
  const [stopModalVisible, setStopModalVisible] = useState(false);
  const [stopTarget, setStopTarget] = useState<{ type: string; id: string; name: string } | null>(null);
  const [stopReason, setStopReason] = useState('');

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
      onOk() {
        setGlobalEnabled(checked);
        message.success(`全局信号已${action}`);
      },
    });
  };

  // 策略开关切换
  const handleStrategySwitch = (strategy: IStrategySwitch) => {
    if (strategy.status === 'running') {
      setStopTarget({ type: 'strategy', id: strategy.id, name: strategy.name });
      setStopModalVisible(true);
    } else {
      confirm({
        title: `确认恢复策略 "${strategy.name}"？`,
        icon: <PlayCircleOutlined />,
        content: '恢复后该策略将继续发送信号',
        okText: '确认恢复',
        cancelText: '取消',
        onOk() {
          setStrategies(strategies.map(s =>
            s.id === strategy.id ? { ...s, status: 'running', stoppedAt: undefined, stoppedBy: undefined, reason: undefined } : s
          ));
          message.success(`策略 "${strategy.name}" 已恢复`);
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
        onOk() {
          setUsers(users.map(u =>
            u.userId === user.userId ? { ...u, status: 'active', stoppedAt: undefined, stoppedBy: undefined, reason: undefined } : u
          ));
          message.success(`用户 "${user.username}" 已恢复`);
        },
      });
    }
  };

  // 确认停止
  const handleConfirmStop = () => {
    if (!stopTarget || !stopReason.trim()) {
      message.error('请填写停止原因');
      return;
    }

    if (stopTarget.type === 'strategy') {
      setStrategies(strategies.map(s =>
        s.id === stopTarget.id
          ? { ...s, status: 'stopped', stoppedAt: new Date().toLocaleString(), stoppedBy: 'admin', reason: stopReason }
          : s
      ));
    } else if (stopTarget.type === 'user') {
      setUsers(users.map(u =>
        u.userId === stopTarget.id
          ? { ...u, status: 'stopped', stoppedAt: new Date().toLocaleString(), stoppedBy: 'admin', reason: stopReason }
          : u
      ));
    }

    message.success(`已停止: ${stopTarget.name}`);
    setStopModalVisible(false);
    setStopTarget(null);
    setStopReason('');
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
      onOk() {
        setStrategies(strategies.map(s => ({
          ...s,
          status: 'stopped',
          stoppedAt: new Date().toLocaleString(),
          stoppedBy: 'admin',
          reason: '一键停止所有策略',
        })));
        message.success('已停止所有策略');
      },
    });
  };

  const strategyColumns = [
    { title: '策略ID', dataIndex: 'id', key: 'id' },
    { title: '策略名称', dataIndex: 'name', key: 'name', render: (name: string) => <Text strong>{name}</Text> },
    { title: '订阅人数', dataIndex: 'subscribers', key: 'subscribers' },
    { title: '最后信号', dataIndex: 'lastSignal', key: 'lastSignal', render: (t: string) => <Text type="secondary">{t}</Text> },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string, record: IStrategySwitch) => (
        <Space direction="vertical" size={0}>
          <Tag color={status === 'running' ? 'success' : 'error'}>
            {status === 'running' ? '运行中' : '已停止'}
          </Tag>
          {record.stoppedAt && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.stoppedBy} 于 {record.stoppedAt}
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
          checked={record.status === 'running'}
          onChange={() => handleStrategySwitch(record)}
          checkedChildren="运行"
          unCheckedChildren="停止"
        />
      ),
    },
  ];

  const userColumns = [
    { title: '用户ID', dataIndex: 'userId', key: 'userId' },
    { title: '邮箱', dataIndex: 'email', key: 'email' },
    { title: '用户名', dataIndex: 'username', key: 'username' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string, record: IUserSwitch) => (
        <Space direction="vertical" size={0}>
          <Tag color={status === 'active' ? 'success' : 'error'}>
            {status === 'active' ? '正常' : '已停止'}
          </Tag>
          {record.stoppedAt && (
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

  const runningStrategies = strategies.filter(s => s.status === 'running').length;
  const stoppedStrategies = strategies.filter(s => s.status === 'stopped').length;

  return (
    <div style={{ padding: 24 }}>
      <Title level={4} style={{ marginBottom: 24 }}>紧急开关</Title>

      {/* 全局状态警告 */}
      {!globalEnabled && (
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
              value={globalEnabled ? '开启' : '关闭'}
              valueStyle={{ color: globalEnabled ? '#52c41a' : '#f5222d' }}
              prefix={globalEnabled ? <ThunderboltOutlined /> : <StopOutlined />}
            />
            <div style={{ marginTop: 16 }}>
              <Switch
                checked={globalEnabled}
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
              value={runningStrategies}
              suffix={`/ ${strategies.length}`}
              valueStyle={{ color: '#52c41a' }}
              prefix={<RocketOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已停止策略"
              value={stoppedStrategies}
              valueStyle={{ color: stoppedStrategies > 0 ? '#faad14' : '#52c41a' }}
              prefix={<WarningOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="受影响用户"
              value={strategies.filter(s => s.status === 'stopped').reduce((sum, s) => sum + s.subscribers, 0)}
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
            disabled={runningStrategies === 0}
          >
            一键停止所有策略
          </Button>
          <Button
            icon={<PlayCircleOutlined />}
            onClick={() => {
              setStrategies(strategies.map(s => ({ ...s, status: 'running', stoppedAt: undefined, stoppedBy: undefined, reason: undefined })));
              message.success('已恢复所有策略');
            }}
            disabled={stoppedStrategies === 0}
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
            style={{ width: 200 }}
            filterOption={(input, option) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
            options={users.map(u => ({ value: u.userId, label: u.email }))}
          />
        }
        style={{ marginBottom: 24 }}
      >
        <Table
          dataSource={users}
          columns={userColumns}
          rowKey="userId"
          pagination={{ pageSize: 10 }}
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
        <Timeline
          items={mockLogs.map(log => ({
            color: log.action === 'stop' ? 'red' : 'green',
            children: (
              <div>
                <Text strong>
                  {log.action === 'stop' ? '停止' : '恢复'}
                  {log.type === 'global' ? ' 全局信号' : log.type === 'strategy' ? ` 策略: ${log.target}` : ` 用户: ${log.target}`}
                </Text>
                <br />
                <Text type="secondary">原因: {log.reason}</Text>
                <br />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  操作人: {log.operator} | {log.time}
                </Text>
              </div>
            ),
          }))}
        />
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
