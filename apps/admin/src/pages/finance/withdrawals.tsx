/**
 * 提现审核页面
 * 财务中心 - 提现申请审核
 *
 * 已对接真实 API:
 * - GET /admin/withdraws
 * - POST /admin/withdraws/:id/process
 */
import { useState, useEffect, useCallback } from 'react';
import { List } from '@refinedev/antd';
import {
  Table,
  Tag,
  Space,
  Button,
  Modal,
  Card,
  Row,
  Col,
  Statistic,
  Input,
  Typography,
  Tooltip,
  Spin,
  Alert,
  Select,
} from 'antd';
import {
  CheckOutlined,
  CloseOutlined,
  ExclamationCircleOutlined,
  CopyOutlined,
  ReloadOutlined,
  SendOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { api } from '../../lib/api';
import { useMessage } from '../../hooks';

const { TextArea } = Input;
const { Text } = Typography;

interface IWithdrawal {
  id: string;
  userId: string;
  amount: string;
  asset: 'USDT' | 'HOOT';
  address: string;
  network: string;
  status: 'pending' | 'approved' | 'rejected' | 'processing' | 'completed' | 'failed';
  txHash: string | null;
  createdAt: string;
  processedAt: string | null;
  user: {
    id: string;
    email: string;
    nickname: string | null;
  };
}

interface WithdrawListResponse {
  items: IWithdrawal[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const WithdrawalList = () => {
  const message = useMessage();
  const [dataSource, setDataSource] = useState<IWithdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selectedRows, setSelectedRows] = useState<IWithdrawal[]>([]);
  const [rejectReason, setRejectReason] = useState('');
  const [txHashInput, setTxHashInput] = useState('');

  const statusConfig = {
    pending: { color: 'warning', label: '待审核' },
    approved: { color: 'processing', label: '已通过' },
    rejected: { color: 'error', label: '已拒绝' },
    processing: { color: 'processing', label: '处理中' },
    completed: { color: 'success', label: '已完成' },
    failed: { color: 'error', label: '失败' },
  };

  // 获取提现列表
  const fetchWithdrawals = useCallback(async (page = 1, status = '') => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pagination.pageSize),
      });
      if (status) params.set('status', status);

      const data = await api.get<WithdrawListResponse>(`/admin/withdraws?${params.toString()}`);
      setDataSource(data.items);
      setPagination(prev => ({
        ...prev,
        current: data.page,
        total: data.total,
      }));
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '获取提现列表失败';
      setError(errorMessage);
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [pagination.pageSize]);

  useEffect(() => {
    fetchWithdrawals();
  }, [fetchWithdrawals]);

  // 筛选变化
  const handleStatusChange = (value: string) => {
    setStatusFilter(value);
    fetchWithdrawals(1, value);
  };

  // 分页变化
  const handleTableChange = (paginationConfig: { current?: number }) => {
    fetchWithdrawals(paginationConfig.current || 1, statusFilter);
  };

  // 统计数据
  const pendingItems = dataSource.filter((w) => w.status === 'pending');
  const pendingCount = pendingItems.length;
  const pendingAmount = pendingItems.reduce((sum, w) => sum + parseFloat(w.amount), 0);
  const approvedCount = dataSource.filter((w) => w.status === 'approved').length;
  const todayCompleted = dataSource.filter((w) => w.status === 'completed').length;

  // 审核通过
  const handleApprove = (withdrawal: IWithdrawal) => {
    Modal.confirm({
      title: '确认通过提现申请',
      icon: <ExclamationCircleOutlined />,
      content: (
        <div>
          <p>用户: {withdrawal.user?.nickname || withdrawal.user?.email}</p>
          <p>金额: {withdrawal.amount} {withdrawal.asset}</p>
          <p>网络: {withdrawal.network}</p>
          <p>目标地址: {withdrawal.address.slice(0, 10)}...{withdrawal.address.slice(-8)}</p>
          <div style={{ marginTop: 16 }}>
            <Text>交易哈希 (可选):</Text>
            <Input
              placeholder="输入链上交易哈希"
              value={txHashInput}
              onChange={(e) => setTxHashInput(e.target.value)}
              style={{ marginTop: 8 }}
            />
          </div>
        </div>
      ),
      okText: '确认通过',
      cancelText: '取消',
      async onOk() {
        try {
          await api.post(`/admin/withdraws/${withdrawal.id}/process`, {
            action: 'approved',
            txHash: txHashInput || undefined,
          });
          message.success('提现申请已通过');
          setTxHashInput('');
          fetchWithdrawals(pagination.current, statusFilter);
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : '操作失败';
          message.error(errorMessage);
        }
      },
    });
  };

  // 审核拒绝
  const handleReject = (withdrawal: IWithdrawal) => {
    Modal.confirm({
      title: '拒绝提现申请',
      icon: <ExclamationCircleOutlined />,
      content: (
        <div>
          <p>用户: {withdrawal.user?.nickname || withdrawal.user?.email}</p>
          <p>金额: {withdrawal.amount} {withdrawal.asset}</p>
          <div style={{ marginTop: 16 }}>
            <Text>拒绝原因 (必填):</Text>
            <TextArea
              rows={3}
              placeholder="请输入拒绝原因"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              style={{ marginTop: 8 }}
            />
          </div>
        </div>
      ),
      okText: '确认拒绝',
      okButtonProps: { danger: true },
      cancelText: '取消',
      async onOk() {
        if (!rejectReason.trim()) {
          message.error('请输入拒绝原因');
          return Promise.reject();
        }
        try {
          await api.post(`/admin/withdraws/${withdrawal.id}/process`, {
            action: 'rejected',
            reason: rejectReason,
          });
          message.success('提现申请已拒绝，余额已退还');
          setRejectReason('');
          fetchWithdrawals(pagination.current, statusFilter);
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : '操作失败';
          message.error(errorMessage);
        }
      },
    });
  };

  // 执行提现（上链）
  const handleExecute = (withdrawal: IWithdrawal) => {
    Modal.confirm({
      title: '确认执行提现上链',
      icon: <ExclamationCircleOutlined />,
      content: (
        <div>
          <p>用户: {withdrawal.user?.nickname || withdrawal.user?.email}</p>
          <p>金额: {withdrawal.amount} {withdrawal.asset}</p>
          <p>网络: {withdrawal.network || 'BSC'}</p>
          <p>目标地址: {withdrawal.address}</p>
          <Alert
            type="warning"
            message="此操作将从热钱包发起链上转账，执行后不可撤回"
            style={{ marginTop: 8 }}
          />
        </div>
      ),
      okText: '确认执行',
      okButtonProps: { danger: true },
      cancelText: '取消',
      async onOk() {
        try {
          const result = await api.post<{ success: boolean; txHash?: string; error?: string }>(
            `/blockchain/withdraw/${withdrawal.id}/execute`,
          );
          if (result.success) {
            message.success(`提现已执行，txHash: ${result.txHash?.slice(0, 16)}...`);
          } else {
            message.error(`执行失败: ${result.error}`);
          }
          fetchWithdrawals(pagination.current, statusFilter);
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : '执行失败';
          message.error(errorMessage);
        }
      },
    });
  };

  // 批量执行提现
  const handleBatchExecute = () => {
    const approvedRows = dataSource.filter((r) => r.status === 'approved');
    if (approvedRows.length === 0) {
      message.warning('没有已审批待执行的提现');
      return;
    }

    Modal.confirm({
      title: '批量执行提现',
      icon: <ThunderboltOutlined />,
      content: (
        <div>
          <p>将批量执行 <strong>{approvedRows.length}</strong> 条已审批的提现。</p>
          <Alert
            type="warning"
            message="批量执行将逐条上链转账，执行后不可撤回"
            style={{ marginTop: 8 }}
          />
        </div>
      ),
      okText: '确认批量执行',
      okButtonProps: { danger: true },
      cancelText: '取消',
      async onOk() {
        try {
          const result = await api.post<{ successCount: number; failCount: number }>(
            '/blockchain/withdraw/batch-execute',
            { withdrawRequestIds: approvedRows.map((r) => r.id) },
          );
          if (result.failCount === 0) {
            message.success(`批量执行完成，成功 ${result.successCount} 笔`);
          } else {
            message.warning(`批量执行部分完成：成功 ${result.successCount}，失败 ${result.failCount}`);
          }
          fetchWithdrawals(pagination.current, statusFilter);
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : '批量执行失败';
          message.error(errorMessage);
        }
      },
    });
  };

  // 批量通过
  const handleBatchApprove = () => {
    if (selectedRows.length === 0) {
      message.warning('请先选择要审核的提现申请');
      return;
    }

    Modal.confirm({
      title: '批量通过提现申请',
      icon: <ExclamationCircleOutlined />,
      content: `确定要通过选中的 ${selectedRows.length} 条提现申请吗？`,
      okText: '确认通过',
      cancelText: '取消',
      async onOk() {
        try {
          // 逐个处理
          for (const withdrawal of selectedRows) {
            await api.post(`/admin/withdraws/${withdrawal.id}/process`, {
              action: 'approved',
            });
          }
          message.success(`已通过 ${selectedRows.length} 条提现申请`);
          setSelectedRows([]);
          fetchWithdrawals(pagination.current, statusFilter);
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : '批量操作失败';
          message.error(errorMessage);
        }
      },
    });
  };

  const copyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    message.success('地址已复制');
  };

  const columns = [
    {
      title: '申请ID',
      dataIndex: 'id',
      key: 'id',
      width: 100,
      render: (id: string) => id.slice(0, 8) + '...',
    },
    {
      title: '用户',
      key: 'user',
      render: (_: unknown, record: IWithdrawal) => (
        <div>
          <div style={{ fontWeight: 500 }}>{record.user?.nickname || '未设置昵称'}</div>
          <div style={{ fontSize: 12, color: '#999' }}>{record.user?.email}</div>
        </div>
      ),
    },
    {
      title: '提现金额',
      dataIndex: 'amount',
      key: 'amount',
      width: 140,
      render: (amount: string, record: IWithdrawal) => (
        <span style={{ fontWeight: 500 }}>
          {parseFloat(amount).toLocaleString()} {record.asset}
        </span>
      ),
    },
    {
      title: '网络',
      dataIndex: 'network',
      key: 'network',
      width: 100,
      render: (network: string) => <Tag>{network || 'BSC'}</Tag>,
    },
    {
      title: '目标地址',
      dataIndex: 'address',
      key: 'address',
      width: 180,
      render: (address: string) => (
        <Space>
          <Tooltip title={address}>
            <Text>
              {address.slice(0, 6)}...{address.slice(-4)}
            </Text>
          </Tooltip>
          <Button
            type="text"
            size="small"
            icon={<CopyOutlined />}
            onClick={() => copyAddress(address)}
          />
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: keyof typeof statusConfig) => (
        <Tag color={statusConfig[status]?.color || 'default'}>
          {statusConfig[status]?.label || status}
        </Tag>
      ),
    },
    {
      title: '申请时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (value: string) => new Date(value).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 150,
      render: (_: unknown, record: IWithdrawal) => (
        <Space>
          {record.status === 'pending' && (
            <>
              <Button
                type="primary"
                size="small"
                icon={<CheckOutlined />}
                onClick={() => handleApprove(record)}
              >
                通过
              </Button>
              <Button
                danger
                size="small"
                icon={<CloseOutlined />}
                onClick={() => handleReject(record)}
              >
                拒绝
              </Button>
            </>
          )}
          {record.status === 'approved' && (
            <Button
              type="primary"
              size="small"
              icon={<SendOutlined />}
              onClick={() => handleExecute(record)}
            >
              执行上链
            </Button>
          )}
          {record.status === 'completed' && record.txHash && (
            <Tooltip title="查看交易">
              <Button size="small" type="link">
                {record.txHash.slice(0, 10)}...
              </Button>
            </Tooltip>
          )}
          {record.status === 'failed' && (
            <Tooltip title="重新执行">
              <Button
                size="small"
                icon={<SendOutlined />}
                onClick={() => handleExecute(record)}
              >
                重试
              </Button>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  const rowSelection = {
    selectedRowKeys: selectedRows.map((r) => r.id),
    onChange: (_: React.Key[], rows: IWithdrawal[]) => {
      setSelectedRows(rows.filter((r) => r.status === 'pending'));
    },
    getCheckboxProps: (record: IWithdrawal) => ({
      disabled: record.status !== 'pending',
    }),
  };

  return (
    <List
      title="提现审核"
      headerButtons={
        <Space>
          <Select
            placeholder="筛选状态"
            value={statusFilter || undefined}
            onChange={handleStatusChange}
            allowClear
            style={{ width: 120 }}
            options={[
              { value: 'pending', label: '待审核' },
              { value: 'approved', label: '待执行' },
              { value: 'processing', label: '处理中' },
              { value: 'rejected', label: '已拒绝' },
              { value: 'completed', label: '已完成' },
              { value: 'failed', label: '失败' },
            ]}
          />
          <Button
            icon={<ReloadOutlined spin={loading} />}
            onClick={() => fetchWithdrawals(pagination.current, statusFilter)}
          >
            刷新
          </Button>
          <Button
            type="primary"
            onClick={handleBatchApprove}
            disabled={selectedRows.length === 0}
          >
            批量通过 ({selectedRows.length})
          </Button>
          <Button
            danger
            icon={<ThunderboltOutlined />}
            onClick={handleBatchExecute}
            disabled={!dataSource.some((r) => r.status === 'approved')}
          >
            批量执行
          </Button>
        </Space>
      }
    >
      {/* 错误提示 */}
      {error && (
        <Alert
          message="数据加载失败"
          description={error}
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          action={
            <Button size="small" onClick={() => fetchWithdrawals()}>重试</Button>
          }
        />
      )}

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="待审核"
              value={pendingCount}
              valueStyle={{ color: '#faad14' }}
              suffix="笔"
              loading={loading}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="待审核金额"
              value={pendingAmount}
              precision={2}
              prefix="$"
              valueStyle={{ color: '#faad14' }}
              loading={loading}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="待执行"
              value={approvedCount}
              valueStyle={{ color: '#1890ff' }}
              suffix="笔"
              loading={loading}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="本页已完成"
              value={todayCompleted}
              valueStyle={{ color: '#52c41a' }}
              suffix="笔"
              loading={loading}
            />
          </Card>
        </Col>
      </Row>

      <Spin spinning={loading}>
        <Table
          dataSource={dataSource}
          columns={columns}
          rowKey="id"
          scroll={{ x: 1200 }}
          rowSelection={rowSelection}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
          }}
          onChange={handleTableChange}
        />
      </Spin>
    </List>
  );
};
