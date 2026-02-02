/**
 * 空投管理页面
 * 生态中心 - 空投记录与释放进度
 *
 * 功能：
 * - 空投概览统计（总发放、已释放、待释放）
 * - 空投记录列表（含释放进度）
 * - 按状态筛选
 *
 * ============================================
 * 链上升级路径（TODO: 部署合约后启用）
 * ============================================
 *
 * 阶段 1（当前-链下）：
 *   - 释放数据：从数据库读取
 *   - 提现：从热钱包转币
 *
 * 阶段 2（未来-链上）：
 *   - 释放数据：改为读取链上合约
 *   - 领取：调用合约 Claim 方法
 *   - UI变更：添加「🔗 查看链上合约」链接
 *
 * 升级步骤：
 *   1. 部署 Vesting 合约到 TON/BSC
 *   2. 配置环境变量 VESTING_CONTRACT_ADDRESS
 *   3. 打开 ENABLE_ONCHAIN_VESTING 开关
 *   4. 表格添加「查看合约」列，跳转到区块浏览器
 *
 * 用户体验：无感升级，界面几乎不变
 * ============================================
 */
import { useState, useEffect } from 'react';
import { List } from '@refinedev/antd';
import {
  Table,
  Tag,
  Card,
  Row,
  Col,
  Statistic,
  Select,
  Input,
  Progress,
  Spin,
  Empty,
  Tooltip,
  Space,
  Button,
} from 'antd';
import {
  GiftOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  LockOutlined,
  UnlockOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { api } from '../../lib/api';
import { useMessage } from '../../hooks';
import dayjs from 'dayjs';

// 空投记录类型
interface AirdropRecord {
  id: string;
  user: {
    id: string;
    email: string;
    nickname: string;
  };
  amount: string;          // 总金额
  balance: string;         // 当前余额（未提取）
  releasedAmount: string;  // 已释放金额
  vestingDays: number;     // 释放周期（天）
  vestingStartAt: string;  // 释放开始时间
  vestingEndAt: string;    // 释放结束时间
  reason: string;          // 空投原因
  status: 'vesting' | 'completed' | 'claimed';
  createdAt: string;
}

// 空投概览类型
interface AirdropOverview {
  totalAirdrop: string;    // 总发放
  totalReleased: string;   // 已释放
  totalLocked: string;     // 待释放
  totalUsers: number;      // 受益用户数
  vestingCount: number;    // 释放中数量
  completedCount: number;  // 已完成数量
}

export const AirdropList = () => {
  const message = useMessage();
  const [overview, setOverview] = useState<AirdropOverview | null>(null);
  const [records, setRecords] = useState<AirdropRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [searchText, setSearchText] = useState('');

  // 获取空投数据
  const fetchData = async () => {
    setLoading(true);
    try {
      // 获取空投记录
      const recordsData = await api.get<{ items: AirdropRecord[]; total: number }>(
        `/admin/ecosystem/token/airdrops?page=${page}&limit=${pageSize}${statusFilter ? `&status=${statusFilter}` : ''}`
      );

      setRecords(recordsData.items || []);
      setTotal(recordsData.total || 0);

      // 计算概览数据
      if (recordsData.items) {
        const items = recordsData.items;
        let totalAirdrop = 0;
        let totalReleased = 0;
        let vestingCount = 0;
        let completedCount = 0;
        const userSet = new Set<string>();

        items.forEach((item: AirdropRecord) => {
          totalAirdrop += parseFloat(item.amount) || 0;
          totalReleased += parseFloat(item.releasedAmount) || 0;
          userSet.add(item.user.id);
          if (item.status === 'vesting') vestingCount++;
          if (item.status === 'completed') completedCount++;
        });

        setOverview({
          totalAirdrop: totalAirdrop.toFixed(2),
          totalReleased: totalReleased.toFixed(2),
          totalLocked: (totalAirdrop - totalReleased).toFixed(2),
          totalUsers: userSet.size,
          vestingCount,
          completedCount,
        });
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '获取空投数据失败';
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [page, pageSize, statusFilter]);

  // 状态配置
  const statusConfig: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
    pending: { color: 'warning', label: '待确认', icon: <ClockCircleOutlined /> },
    confirmed: { color: 'processing', label: '已确认', icon: <CheckCircleOutlined /> },
    vesting: { color: 'processing', label: '释放中', icon: <ClockCircleOutlined /> },
    completed: { color: 'success', label: '已释放', icon: <CheckCircleOutlined /> },
    claimed: { color: 'default', label: '已提取', icon: <UnlockOutlined /> },
  };

  // 计算释放进度
  const calculateProgress = (record: AirdropRecord) => {
    const total = parseFloat(record.amount) || 0;
    const released = parseFloat(record.releasedAmount) || 0;
    if (total === 0) return 0;
    return Math.min(100, Math.round((released / total) * 100));
  };

  // 计算剩余天数
  const getRemainingDays = (record: AirdropRecord) => {
    if (record.status === 'completed') return 0;
    const endDate = dayjs(record.vestingEndAt);
    const now = dayjs();
    const remaining = endDate.diff(now, 'day');
    return Math.max(0, remaining);
  };

  // 格式化金额
  const formatAmount = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(num)) return '0.00';
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // 表格列定义
  const columns = [
    {
      title: '用户',
      key: 'user',
      width: 180,
      render: (_: unknown, record: AirdropRecord) => (
        <div>
          <div style={{ fontWeight: 500 }}>{record.user.nickname || '-'}</div>
          <div style={{ fontSize: 12, color: '#8c8c8c' }}>{record.user.email}</div>
        </div>
      ),
    },
    {
      title: '空投金额',
      dataIndex: 'amount',
      key: 'amount',
      width: 140,
      render: (amount: string) => (
        <span style={{ color: '#52c41a', fontWeight: 500 }}>
          {formatAmount(amount)} HOOT
        </span>
      ),
    },
    {
      title: '释放进度',
      key: 'progress',
      width: 200,
      render: (_: unknown, record: AirdropRecord) => {
        const progress = calculateProgress(record);
        const released = parseFloat(record.releasedAmount) || 0;
        const total = parseFloat(record.amount) || 0;
        const locked = total - released;

        return (
          <Tooltip
            title={
              <div>
                <div>已释放: {formatAmount(released)} HOOT</div>
                <div>待释放: {formatAmount(locked)} HOOT</div>
                <div>释放周期: {record.vestingDays} 天</div>
              </div>
            }
          >
            <div>
              <Progress
                percent={progress}
                size="small"
                status={record.status === 'completed' ? 'success' : 'active'}
                strokeColor={record.status === 'completed' ? '#52c41a' : '#1890ff'}
              />
              <div style={{ fontSize: 12, color: '#8c8c8c' }}>
                {formatAmount(released)} / {formatAmount(total)}
              </div>
            </div>
          </Tooltip>
        );
      },
    },
    {
      title: '当前可用',
      dataIndex: 'balance',
      key: 'balance',
      width: 130,
      render: (balance: string) => (
        <span style={{ color: '#1890ff' }}>
          {formatAmount(balance)} HOOT
        </span>
      ),
    },
    {
      title: '剩余天数',
      key: 'remainingDays',
      width: 100,
      render: (_: unknown, record: AirdropRecord) => {
        const remaining = getRemainingDays(record);
        return (
          <Tag color={remaining > 30 ? 'orange' : remaining > 0 ? 'blue' : 'green'}>
            {remaining > 0 ? `${remaining} 天` : '已完成'}
          </Tag>
        );
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const config = statusConfig[status] || { color: 'default', label: status, icon: null };
        return (
          <Tag color={config.color} icon={config.icon}>
            {config.label}
          </Tag>
        );
      },
    },
    {
      title: '空投原因',
      dataIndex: 'reason',
      key: 'reason',
      width: 150,
      ellipsis: true,
      render: (reason: string) => (
        <Tooltip title={reason}>
          <span>{reason || '-'}</span>
        </Tooltip>
      ),
    },
    {
      title: '发放时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '释放结束',
      dataIndex: 'vestingEndAt',
      key: 'vestingEndAt',
      width: 120,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD'),
    },
  ];

  // 过滤数据
  const filteredRecords = searchText
    ? records.filter(
        (r) =>
          (r.user.email || '').toLowerCase().includes(searchText.toLowerCase()) ||
          (r.user.nickname || '').toLowerCase().includes(searchText.toLowerCase())
      )
    : records;

  return (
    <List title="空投管理" headerButtons={[]}>
      <Spin spinning={loading}>
        {/* 概览统计 */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={12} md={6}>
            <Card size="small">
              <Statistic
                title="总发放"
                value={overview?.totalAirdrop || '0'}
                prefix={<GiftOutlined style={{ color: '#722ed1' }} />}
                suffix="HOOT"
                valueStyle={{ color: '#722ed1' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card size="small">
              <Statistic
                title="已释放"
                value={overview?.totalReleased || '0'}
                prefix={<UnlockOutlined style={{ color: '#52c41a' }} />}
                suffix="HOOT"
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card size="small">
              <Statistic
                title="待释放"
                value={overview?.totalLocked || '0'}
                prefix={<LockOutlined style={{ color: '#faad14' }} />}
                suffix="HOOT"
                valueStyle={{ color: '#faad14' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card size="small">
              <Statistic
                title="释放中 / 已完成"
                value={`${overview?.vestingCount || 0} / ${overview?.completedCount || 0}`}
                prefix={<ClockCircleOutlined style={{ color: '#1890ff' }} />}
                valueStyle={{ color: '#1890ff', fontSize: 20 }}
              />
            </Card>
          </Col>
        </Row>

        {/* 筛选区 */}
        <Card size="small" style={{ marginBottom: 16 }}>
          <Space wrap>
            <Input
              placeholder="搜索用户邮箱/昵称"
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 200 }}
              allowClear
            />
            <Select
              placeholder="状态筛选"
              value={statusFilter}
              onChange={setStatusFilter}
              style={{ width: 120 }}
              allowClear
            >
              <Select.Option value="confirmed">已确认</Select.Option>
              <Select.Option value="vesting">释放中</Select.Option>
              <Select.Option value="completed">已释放</Select.Option>
              <Select.Option value="claimed">已提取</Select.Option>
            </Select>
            <Button icon={<ReloadOutlined />} onClick={fetchData}>
              刷新
            </Button>
          </Space>
        </Card>

        {/* 空投记录表格 */}
        {filteredRecords.length > 0 ? (
          <Table
            dataSource={filteredRecords}
            columns={columns}
            rowKey="id"
            pagination={{
              current: page,
              pageSize: pageSize,
              total: total,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (t) => `共 ${t} 条记录`,
              onChange: (p, ps) => {
                setPage(p);
                setPageSize(ps || 10);
              },
            }}
            scroll={{ x: 1300 }}
            size="middle"
          />
        ) : (
          <Empty description="暂无空投记录" style={{ padding: '60px 0' }} />
        )}

        {/* 说明卡片 */}
        <Card size="small" style={{ marginTop: 16 }}>
          <div style={{ color: '#8c8c8c', fontSize: 13 }}>
            <strong>空投释放规则：</strong>
            <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
              <li>默认释放周期：90 天线性释放</li>
              <li>每日释放量 = 总金额 ÷ 释放天数</li>
              <li>用户可随时提取已释放的可用余额</li>
              <li>释放完成后，剩余未提取金额保留在账户中</li>
            </ul>
          </div>
        </Card>
      </Spin>
    </List>
  );
};
