/**
 * 登录日志页面 — 真实 API 版
 */
import {
  Card,
  Table,
  Tag,
  Space,
  Typography,
  Button,
  Input,
  DatePicker,
  Row,
  Col,
  Statistic,
  Empty,
  message,
} from 'antd';
import {
  SearchOutlined,
  DownloadOutlined,
  UserOutlined,
  ApiOutlined,
} from '@ant-design/icons';
import { useState, useCallback, useEffect } from 'react';
import type { Dayjs } from 'dayjs';
import { adminApi } from '../../lib/admin-api';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

// 后端返回的原始 RefreshToken 记录结构
interface ILoginLog {
  id: string;
  userId: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  revokedAt: string | null;
  user: {
    id: string;
    email: string;
    nickname: string | null;
  };
}

// 简单解析 userAgent，提取系统 + 浏览器信息，不引入额外依赖
function parseUserAgent(ua: string | null): string {
  if (!ua) return '未知';

  let os = '';
  if (/iPhone|iPad/.test(ua)) os = 'iOS';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/Mac OS X/.test(ua)) os = 'macOS';
  else if (/Windows/.test(ua)) os = 'Windows';
  else if (/Linux/.test(ua)) os = 'Linux';

  let browser = '';
  if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/Chrome\//.test(ua)) browser = 'Chrome';
  else if (/Firefox\//.test(ua)) browser = 'Firefox';
  else if (/Safari\//.test(ua)) browser = 'Safari';

  const parts = [os, browser].filter(Boolean);
  if (parts.length > 0) return parts.join(' / ');

  // 解析失败时截断原始字符串
  return ua.length > 40 ? ua.slice(0, 40) + '...' : ua;
}

export const LoginLogsPage = () => {
  const [logs, setLogs] = useState<ILoginLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);

  const PAGE_SIZE = 20;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(PAGE_SIZE));
      if (search) params.set('search', search);
      if (dateRange?.[0]) params.set('startDate', dateRange[0].toISOString());
      if (dateRange?.[1]) params.set('endDate', dateRange[1].toISOString());

      const res = await adminApi.get<{ items: ILoginLog[]; total: number }>(
        `/admin/logs/logins?${params.toString()}`
      );
      const responseData = res.data.data;
      setLogs(responseData.items ?? []);
      setTotal(responseData.total ?? 0);
    } catch {
      message.error('加载登录日志失败');
    } finally {
      setLoading(false);
    }
  }, [page, search, dateRange]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // 统计：独立用户（按当前页去重）
  const uniqueUsers = new Set(logs.map((l) => l.userId)).size;
  // 统计：活跃会话（revokedAt 为 null）
  const activeSessions = logs.filter((l) => l.revokedAt === null).length;

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 100,
      render: (id: string) => (
        <Text code style={{ fontSize: 12 }}>
          {id.slice(0, 8)}
        </Text>
      ),
    },
    {
      title: '用户',
      key: 'user',
      render: (_: unknown, record: ILoginLog) => (
        <Space direction="vertical" size={0}>
          <Text strong>{record.user?.nickname || '—'}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.user?.email}
          </Text>
        </Space>
      ),
    },
    {
      title: 'IP地址',
      dataIndex: 'ipAddress',
      key: 'ipAddress',
      render: (ip: string | null) =>
        ip ? <Text code>{ip}</Text> : <Text type="secondary">—</Text>,
    },
    {
      title: '设备/浏览器',
      dataIndex: 'userAgent',
      key: 'userAgent',
      render: (ua: string | null) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {parseUserAgent(ua)}
        </Text>
      ),
    },
    {
      title: '会话状态',
      key: 'sessionStatus',
      render: (_: unknown, record: ILoginLog) =>
        record.revokedAt === null ? (
          <Tag color="green">活跃</Tag>
        ) : (
          <Tag>已注销</Tag>
        ),
    },
    {
      title: '登录时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (t: string) => new Date(t).toLocaleString('zh-CN'),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Title level={4} style={{ marginBottom: 24 }}>
        登录日志
      </Title>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card>
            <Statistic title="登录次数" value={total} prefix={<UserOutlined />} />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="独立用户（当前页）" value={uniqueUsers} />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="活跃会话（当前页）"
              value={activeSessions}
              prefix={<ApiOutlined />}
              valueStyle={{ color: activeSessions > 0 ? '#52c41a' : undefined }}
            />
          </Card>
        </Col>
      </Row>

      {/* 过滤器 */}
      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input
            placeholder="搜索用户邮箱 / 昵称"
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            style={{ width: 220 }}
            allowClear
          />
          <RangePicker
            showTime
            onChange={(dates) => {
              setDateRange(dates as [Dayjs | null, Dayjs | null] | null);
              setPage(1);
            }}
          />
          <Button
            icon={<DownloadOutlined />}
            onClick={() => message.info('导出功能开发中')}
          >
            导出
          </Button>
        </Space>
      </Card>

      {/* 表格 */}
      <Card>
        <Table
          dataSource={logs}
          columns={columns}
          rowKey="id"
          loading={loading}
          locale={{ emptyText: <Empty description="暂无登录日志" /> }}
          pagination={{
            current: page,
            pageSize: PAGE_SIZE,
            total,
            showTotal: (t) => `共 ${t} 条`,
            onChange: (p) => setPage(p),
          }}
        />
      </Card>
    </div>
  );
};
