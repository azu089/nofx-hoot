/**
 * 日志中心页面
 * 操作日志、交易流水、登录日志 — 全部对接真实 API
 */
import { useState, useCallback, useEffect } from 'react';
import {
  Table,
  Tag,
  Space,
  Card,
  Tabs,
  DatePicker,
  Select,
  Input,
  Typography,
  Pagination,
} from 'antd';
import type { Dayjs } from 'dayjs';
import {
  SwapOutlined,
  LoginOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { adminApi } from '../../lib/admin-api';

const { RangePicker } = DatePicker;
const { Text, Title } = Typography;

// ─── 类型定义 ───────────────────────────────────────────────────────────────

interface IOperationLog {
  id: string;
  adminId: string;
  admin: { id: string; username: string; role: string } | null;
  action: string;
  module: string;
  targetId: string | null;
  targetType: string | null;
  description: string | null;
  details: unknown;
  ipAddress: string | null;
  result: 'success' | 'failed';
  createdAt: string;
}

interface ITransaction {
  id: string;
  userId: string;
  user?: { email: string; nickname: string | null } | null;
  type: 'deposit' | 'withdrawal' | 'admin_credit' | 'admin_debit' | 'refund' | 'gas_fee' | 'subscription';
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  amount: string;
  currency: string;
  txHash: string | null;
  description: string | null;
  createdAt: string;
}

interface ILoginLog {
  id: string;
  userId: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  revokedAt: string | null;
  user: { id: string; email: string; nickname: string | null } | null;
}

interface PagedResult<T> {
  items: T[];
  total: number;
}

// ─── 映射表 ──────────────────────────────────────────────────────────────────

const MODULE_LABEL: Record<string, string> = {
  user: '用户管理',
  strategy: '策略管理',
  withdraw: '提现审核',
  announcement: '公告管理',
  config: '系统设置',
};

// ─── 辅助函数 ────────────────────────────────────────────────────────────────

/** 从 User-Agent 字符串中提取 OS + 浏览器简称 */
function parseUserAgent(ua: string | null): string {
  if (!ua) return '未知设备';

  let os = '未知OS';
  if (/Windows NT/i.test(ua)) os = 'Windows';
  else if (/Macintosh|Mac OS X/i.test(ua)) os = 'macOS';
  else if (/iPhone|iPad/i.test(ua)) os = 'iOS';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/Linux/i.test(ua)) os = 'Linux';

  let browser = '未知浏览器';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/OPR\//i.test(ua) || /Opera/i.test(ua)) browser = 'Opera';
  else if (/Chrome\//i.test(ua)) browser = 'Chrome';
  else if (/Safari\//i.test(ua)) browser = 'Safari';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';

  return `${browser} / ${os}`;
}

/** 交易类型中文标签映射 */
const TX_TYPE_LABELS: Record<ITransaction['type'], string> = {
  deposit: '充值',
  withdrawal: '提现',
  admin_credit: '管理员增款',
  admin_debit: '管理员扣款',
  refund: '退款',
  gas_fee: '手续费',
  subscription: '订阅费',
};

/** 金额是否为收入方向（绿色） */
function isCredit(type: ITransaction['type']): boolean {
  return type === 'deposit' || type === 'admin_credit' || type === 'refund';
}

/** 格式化时间：去掉 T/Z，保留到秒 */
function formatTime(iso: string): string {
  return iso.replace('T', ' ').replace(/\.\d+Z?$/, '');
}

// ─── 主组件 ──────────────────────────────────────────────────────────────────

export const LogsPage = () => {
  const [activeTab, setActiveTab] = useState('operations');

  // ── 操作日志状态 ────────────────────────────────────────────────────────────
  const [opLogs, setOpLogs] = useState<IOperationLog[]>([]);
  const [opTotal, setOpTotal] = useState(0);
  const [opPage, setOpPage] = useState(1);
  const [opLoading, setOpLoading] = useState(false);
  const [opSearch, setOpSearch] = useState('');
  const [opModule, setOpModule] = useState<string | undefined>(undefined);
  const [opResult, setOpResult] = useState<string | undefined>(undefined);
  const [opDates, setOpDates] = useState<[Dayjs | null, Dayjs | null] | null>(null);

  const fetchOpLogs = useCallback(async (page: number) => {
    setOpLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '15',
        search: opSearch,
        module: opModule ?? '',
        result: opResult ?? '',
        startDate: opDates?.[0]?.toISOString() ?? '',
        endDate: opDates?.[1]?.toISOString() ?? '',
      });
      const res = await adminApi.get<PagedResult<IOperationLog>>(
        `/admin/logs/operations?${params}`
      );
      if (res.data.code === 0 && res.data.data) {
        setOpLogs(res.data.data.items);
        setOpTotal(res.data.data.total);
      }
    } catch {
      // 静默处理，表格显示空
    } finally {
      setOpLoading(false);
    }
  }, [opSearch, opModule, opResult, opDates]);

  useEffect(() => {
    if (activeTab === 'operations') {
      fetchOpLogs(opPage);
    }
  }, [activeTab, opPage, fetchOpLogs]);

  // ── 交易流水状态 ────────────────────────────────────────────────────────────
  const [txLogs, setTxLogs] = useState<ITransaction[]>([]);
  const [txTotal, setTxTotal] = useState(0);
  const [txPage, setTxPage] = useState(1);
  const [txLoading, setTxLoading] = useState(false);
  const [txSearch, setTxSearch] = useState('');
  const [txType, setTxType] = useState<string | undefined>(undefined);
  const [txStatus, setTxStatus] = useState<string | undefined>(undefined);
  const [txDates, setTxDates] = useState<[Dayjs | null, Dayjs | null] | null>(null);

  const fetchTxLogs = useCallback(async (page: number) => {
    setTxLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '15',
        search: txSearch,
        type: txType ?? '',
        status: txStatus ?? '',
        startDate: txDates?.[0]?.toISOString() ?? '',
        endDate: txDates?.[1]?.toISOString() ?? '',
      });
      const res = await adminApi.get<PagedResult<ITransaction>>(
        `/admin/transactions?${params}`
      );
      if (res.data.code === 0 && res.data.data) {
        setTxLogs(res.data.data.items);
        setTxTotal(res.data.data.total);
      }
    } catch {
      // 静默处理
    } finally {
      setTxLoading(false);
    }
  }, [txSearch, txType, txStatus, txDates]);

  useEffect(() => {
    if (activeTab === 'trades') {
      fetchTxLogs(txPage);
    }
  }, [activeTab, txPage, fetchTxLogs]);

  // ── 登录日志状态 ────────────────────────────────────────────────────────────
  const [loginLogs, setLoginLogs] = useState<ILoginLog[]>([]);
  const [loginTotal, setLoginTotal] = useState(0);
  const [loginPage, setLoginPage] = useState(1);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginSearch, setLoginSearch] = useState('');
  const [loginDates, setLoginDates] = useState<[Dayjs | null, Dayjs | null] | null>(null);

  const fetchLoginLogs = useCallback(async (page: number) => {
    setLoginLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '15',
        search: loginSearch,
        startDate: loginDates?.[0]?.toISOString() ?? '',
        endDate: loginDates?.[1]?.toISOString() ?? '',
      });
      const res = await adminApi.get<PagedResult<ILoginLog>>(
        `/admin/logs/logins?${params}`
      );
      if (res.data.code === 0 && res.data.data) {
        setLoginLogs(res.data.data.items);
        setLoginTotal(res.data.data.total);
      }
    } catch {
      // 静默处理
    } finally {
      setLoginLoading(false);
    }
  }, [loginSearch, loginDates]);

  useEffect(() => {
    if (activeTab === 'logins') {
      fetchLoginLogs(loginPage);
    }
  }, [activeTab, loginPage, fetchLoginLogs]);

  // ─── 列定义 ────────────────────────────────────────────────────────────────

  const operationColumns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
      render: (id: string) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {id.slice(0, 8)}…
        </Text>
      ),
    },
    {
      title: '操作人',
      key: 'admin',
      width: 140,
      render: (_: unknown, record: IOperationLog) => (
        <Space>
          <SettingOutlined style={{ color: '#f5222d' }} />
          <div>
            <div>{record.admin?.username ?? record.adminId.slice(0, 8)}</div>
            <Text type="secondary" style={{ fontSize: 11 }}>
              {record.admin?.role ?? ''}
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: '模块',
      dataIndex: 'module',
      key: 'module',
      width: 110,
      render: (module: string) => <Tag>{MODULE_LABEL[module] ?? module}</Tag>,
    },
    {
      title: '操作',
      dataIndex: 'action',
      key: 'action',
      width: 160,
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (desc: string | null) => desc ?? '—',
    },
    {
      title: 'IP',
      dataIndex: 'ipAddress',
      key: 'ipAddress',
      width: 130,
      render: (ip: string | null) => ip ?? '—',
    },
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 170,
      render: (t: string) => formatTime(t),
    },
    {
      title: '结果',
      dataIndex: 'result',
      key: 'result',
      width: 80,
      render: (result: string) => (
        <Tag color={result === 'success' ? 'success' : 'error'}>
          {result === 'success' ? '成功' : '失败'}
        </Tag>
      ),
    },
  ];

  const transactionColumns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
      render: (id: string) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {id.slice(0, 8)}…
        </Text>
      ),
    },
    {
      title: '用户',
      key: 'user',
      width: 160,
      render: (_: unknown, record: ITransaction) => (
        <div>
          <div>{record.user?.nickname || record.user?.email || '—'}</div>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {record.user?.email || `ID: ${record.userId.slice(0, 8)}`}
          </Text>
        </div>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 110,
      render: (type: ITransaction['type']) => (
        <Tag color={isCredit(type) ? 'green' : 'red'}>
          {TX_TYPE_LABELS[type] ?? type}
        </Tag>
      ),
    },
    {
      title: '金额',
      key: 'amount',
      width: 130,
      render: (_: unknown, record: ITransaction) => {
        const credit = isCredit(record.type);
        const sign = credit ? '+' : '-';
        return (
          <Text style={{ color: credit ? '#52c41a' : '#f5222d', fontWeight: 600 }}>
            {sign}{record.amount} {record.currency}
          </Text>
        );
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (status: ITransaction['status']) => {
        const colorMap: Record<ITransaction['status'], string> = {
          pending: 'processing',
          completed: 'success',
          failed: 'error',
          cancelled: 'default',
        };
        const labelMap: Record<ITransaction['status'], string> = {
          pending: '待处理',
          completed: '已完成',
          failed: '失败',
          cancelled: '已取消',
        };
        return <Tag color={colorMap[status]}>{labelMap[status]}</Tag>;
      },
    },
    {
      title: '交易哈希',
      dataIndex: 'txHash',
      key: 'txHash',
      width: 140,
      ellipsis: true,
      render: (hash: string | null) =>
        hash ? (
          <Text copyable={{ text: hash }} style={{ fontSize: 12 }}>
            {hash.slice(0, 10)}…
          </Text>
        ) : (
          '—'
        ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (desc: string | null) => desc ?? '—',
    },
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 170,
      render: (t: string) => formatTime(t),
    },
  ];

  const loginColumns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
      render: (id: string) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {id.slice(0, 8)}…
        </Text>
      ),
    },
    {
      title: '用户',
      key: 'user',
      width: 180,
      render: (_: unknown, record: ILoginLog) => (
        <div>
          <div>{record.user?.nickname || record.user?.email || '—'}</div>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {record.user?.email || `ID: ${record.userId.slice(0, 8)}`}
          </Text>
        </div>
      ),
    },
    {
      title: 'IP',
      dataIndex: 'ipAddress',
      key: 'ipAddress',
      width: 130,
      render: (ip: string | null) => ip ?? '—',
    },
    {
      title: '设备',
      dataIndex: 'userAgent',
      key: 'userAgent',
      width: 200,
      ellipsis: true,
      render: (ua: string | null) => parseUserAgent(ua),
    },
    {
      title: '会话状态',
      key: 'session',
      width: 100,
      render: (_: unknown, record: ILoginLog) =>
        record.revokedAt === null ? (
          <Tag color="success">活跃</Tag>
        ) : (
          <Tag color="default">已注销</Tag>
        ),
    },
    {
      title: '登录时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 170,
      render: (t: string) => formatTime(t),
    },
  ];

  // ─── Tab 筛选器 & 触发搜索 ─────────────────────────────────────────────────

  const handleOpSearch = () => {
    setOpPage(1);
    fetchOpLogs(1);
  };

  const handleTxSearch = () => {
    setTxPage(1);
    fetchTxLogs(1);
  };

  const handleLoginSearch = () => {
    setLoginPage(1);
    fetchLoginLogs(1);
  };

  // ─── Tab 内容 ──────────────────────────────────────────────────────────────

  const tabItems = [
    {
      key: 'operations',
      label: (
        <Space>
          <SettingOutlined />
          操作日志
        </Space>
      ),
      children: (
        <>
          <Card style={{ marginBottom: 16 }}>
            <Space wrap>
              <Input.Search
                placeholder="搜索操作人/操作"
                style={{ width: 180 }}
                allowClear
                value={opSearch}
                onChange={(e) => setOpSearch(e.target.value)}
                onSearch={handleOpSearch}
              />
              <Select
                placeholder="模块"
                style={{ width: 140 }}
                allowClear
                value={opModule}
                onChange={(v) => { setOpModule(v); setOpPage(1); }}
                options={[
                  { label: '用户管理', value: 'user' },
                  { label: '策略管理', value: 'strategy' },
                  { label: '提现审核', value: 'withdraw' },
                  { label: '公告管理', value: 'announcement' },
                  { label: '系统设置', value: 'config' },
                ]}
              />
              <Select
                placeholder="结果"
                style={{ width: 100 }}
                allowClear
                value={opResult}
                onChange={(v) => { setOpResult(v); setOpPage(1); }}
                options={[
                  { label: '成功', value: 'success' },
                  { label: '失败', value: 'failed' },
                ]}
              />
              <RangePicker
                placeholder={['开始时间', '结束时间']}
                showTime
                onChange={(dates) => {
                  setOpDates(dates as [Dayjs | null, Dayjs | null] | null);
                  setOpPage(1);
                }}
              />
            </Space>
          </Card>
          <Table
            dataSource={opLogs}
            columns={operationColumns}
            rowKey="id"
            loading={opLoading}
            pagination={false}
            scroll={{ x: 900 }}
          />
          <div style={{ marginTop: 16, textAlign: 'right' }}>
            <Pagination
              current={opPage}
              pageSize={15}
              total={opTotal}
              showTotal={(total) => `共 ${total} 条`}
              showSizeChanger={false}
              onChange={(page) => setOpPage(page)}
            />
          </div>
        </>
      ),
    },
    {
      key: 'trades',
      label: (
        <Space>
          <SwapOutlined />
          交易流水
        </Space>
      ),
      children: (
        <>
          <Card style={{ marginBottom: 16 }}>
            <Space wrap>
              <Input.Search
                placeholder="搜索用户邮箱/昵称"
                style={{ width: 200 }}
                allowClear
                value={txSearch}
                onChange={(e) => setTxSearch(e.target.value)}
                onSearch={handleTxSearch}
              />
              <Select
                placeholder="类型"
                style={{ width: 140 }}
                allowClear
                value={txType}
                onChange={(v) => { setTxType(v); setTxPage(1); }}
                options={[
                  { label: '充值', value: 'deposit' },
                  { label: '提现', value: 'withdrawal' },
                  { label: '管理员增款', value: 'admin_credit' },
                  { label: '管理员扣款', value: 'admin_debit' },
                  { label: '退款', value: 'refund' },
                  { label: '手续费', value: 'gas_fee' },
                  { label: '订阅费', value: 'subscription' },
                ]}
              />
              <Select
                placeholder="状态"
                style={{ width: 110 }}
                allowClear
                value={txStatus}
                onChange={(v) => { setTxStatus(v); setTxPage(1); }}
                options={[
                  { label: '待处理', value: 'pending' },
                  { label: '已完成', value: 'completed' },
                  { label: '失败', value: 'failed' },
                  { label: '已取消', value: 'cancelled' },
                ]}
              />
              <RangePicker
                placeholder={['开始时间', '结束时间']}
                showTime
                onChange={(dates) => {
                  setTxDates(dates as [Dayjs | null, Dayjs | null] | null);
                  setTxPage(1);
                }}
              />
            </Space>
          </Card>
          <Table
            dataSource={txLogs}
            columns={transactionColumns}
            rowKey="id"
            loading={txLoading}
            pagination={false}
            scroll={{ x: 1000 }}
          />
          <div style={{ marginTop: 16, textAlign: 'right' }}>
            <Pagination
              current={txPage}
              pageSize={15}
              total={txTotal}
              showTotal={(total) => `共 ${total} 条`}
              showSizeChanger={false}
              onChange={(page) => setTxPage(page)}
            />
          </div>
        </>
      ),
    },
    {
      key: 'logins',
      label: (
        <Space>
          <LoginOutlined />
          登录日志
        </Space>
      ),
      children: (
        <>
          <Card style={{ marginBottom: 16 }}>
            <Space wrap>
              <Input.Search
                placeholder="搜索用户邮箱/昵称"
                style={{ width: 200 }}
                allowClear
                value={loginSearch}
                onChange={(e) => setLoginSearch(e.target.value)}
                onSearch={handleLoginSearch}
              />
              <RangePicker
                placeholder={['开始时间', '结束时间']}
                showTime
                onChange={(dates) => {
                  setLoginDates(dates as [Dayjs | null, Dayjs | null] | null);
                  setLoginPage(1);
                }}
              />
            </Space>
          </Card>
          <Table
            dataSource={loginLogs}
            columns={loginColumns}
            rowKey="id"
            loading={loginLoading}
            pagination={false}
            scroll={{ x: 900 }}
          />
          <div style={{ marginTop: 16, textAlign: 'right' }}>
            <Pagination
              current={loginPage}
              pageSize={15}
              total={loginTotal}
              showTotal={(total) => `共 ${total} 条`}
              showSizeChanger={false}
              onChange={(page) => setLoginPage(page)}
            />
          </div>
        </>
      ),
    },
  ];

  // ─── 渲染 ───────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: '0 0 24px' }}>
      <Title level={4} style={{ marginBottom: 16 }}>
        日志中心
      </Title>
      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key)}
          items={tabItems}
        />
      </Card>
    </div>
  );
};
