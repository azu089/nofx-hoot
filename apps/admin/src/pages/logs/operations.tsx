/**
 * 操作日志页面
 * 管理员操作记录 — 对接真实 API
 */
import {
  Card,
  Table,
  Tag,
  Space,
  Typography,
  Button,
  Input,
  Select,
  DatePicker,
  message,
} from 'antd';
import {
  SearchOutlined,
  DownloadOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { useState, useEffect, useCallback } from 'react';
import { adminApi } from '../../lib/admin-api';
import type { Dayjs } from 'dayjs';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

interface IOperationLog {
  id: string;
  adminId: string;
  admin: { id: string; username: string; role: string };
  action: string;
  module: string;
  targetId: string | null;
  targetType: string | null;
  description: string | null;
  details: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  result: string;
  createdAt: string;
}

// 模块名称映射
const MODULE_LABEL: Record<string, string> = {
  user: '用户管理',
  strategy: '策略管理',
  withdraw: '提现审核',
  announcement: '公告管理',
  config: '系统设置',
};

// 操作名称映射
const ACTION_LABEL: Record<string, string> = {
  login: '登录',
  create: '创建',
  update: '更新',
  delete: '删除',
  approve: '审批通过',
  reject: '审批拒绝',
};

export const OperationLogsPage = () => {
  const [logs, setLogs] = useState<IOperationLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);

  // 筛选条件
  const [search, setSearch] = useState('');
  const [module, setModule] = useState('');
  const [result, setResult] = useState('');
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
        ...(search ? { search } : {}),
        ...(module ? { module } : {}),
        ...(result ? { result } : {}),
        ...(dateRange?.[0] ? { startDate: dateRange[0].toISOString() } : {}),
        ...(dateRange?.[1] ? { endDate: dateRange[1].toISOString() } : {}),
      });
      const res = await adminApi.get<{ items: IOperationLog[]; total: number }>(
        `/admin/logs/operations?${params}`
      );
      const responseData = res.data.data;
      setLogs(responseData?.items || []);
      setTotal(responseData?.total || 0);
    } catch (err: unknown) {
      console.error('加载操作日志失败', err);
      message.error('加载操作日志失败');
    } finally {
      setLoading(false);
    }
  }, [page, search, module, result, dateRange]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const columns = [
    {
      title: '操作人',
      key: 'operator',
      width: 140,
      render: (_: unknown, record: IOperationLog) => (
        <Space direction="vertical" size={0}>
          <Text strong>{record.admin?.username ?? record.adminId}</Text>
          <Tag>{record.admin?.role ?? '-'}</Tag>
        </Space>
      ),
    },
    {
      title: '模块',
      dataIndex: 'module',
      key: 'module',
      width: 110,
      render: (mod: string) => (
        <Tag color="blue">{MODULE_LABEL[mod] ?? mod}</Tag>
      ),
    },
    {
      title: '操作',
      dataIndex: 'action',
      key: 'action',
      width: 100,
      render: (action: string) => (
        <Tag color="geekblue">{ACTION_LABEL[action] ?? action}</Tag>
      ),
    },
    {
      title: '操作对象',
      key: 'target',
      width: 160,
      render: (_: unknown, record: IOperationLog) => (
        record.targetId ? (
          <Space>
            <Text>{record.targetType ?? '-'}</Text>
            <Text type="secondary">({record.targetId})</Text>
          </Space>
        ) : (
          <Text type="secondary">-</Text>
        )
      ),
    },
    {
      title: '操作描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (desc: string | null) => desc ?? '-',
    },
    {
      title: 'IP 地址',
      dataIndex: 'ipAddress',
      key: 'ipAddress',
      width: 140,
      render: (ip: string | null) =>
        ip ? <Text code>{ip}</Text> : <Text type="secondary">-</Text>,
    },
    {
      title: '结果',
      dataIndex: 'result',
      key: 'result',
      width: 90,
      render: (res: string) => (
        <Tag
          icon={res === 'success' ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
          color={res === 'success' ? 'success' : 'error'}
        >
          {res === 'success' ? '成功' : '失败'}
        </Tag>
      ),
    },
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 170,
      render: (v: string) => new Date(v).toLocaleString('zh-CN'),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>操作日志</Title>
        <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
          刷新
        </Button>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input
            placeholder="搜索操作人/描述"
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            style={{ width: 200 }}
            allowClear
          />
          <Select
            placeholder="模块"
            value={module || undefined}
            onChange={(value) => {
              setModule(value ?? '');
              setPage(1);
            }}
            style={{ width: 140 }}
            allowClear
            options={[
              { value: 'user', label: '用户管理' },
              { value: 'strategy', label: '策略管理' },
              { value: 'withdraw', label: '提现审核' },
              { value: 'announcement', label: '公告管理' },
              { value: 'config', label: '系统设置' },
            ]}
          />
          <Select
            placeholder="结果"
            value={result || undefined}
            onChange={(value) => {
              setResult(value ?? '');
              setPage(1);
            }}
            style={{ width: 100 }}
            allowClear
            options={[
              { value: 'success', label: '成功' },
              { value: 'failed', label: '失败' },
            ]}
          />
          <RangePicker
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

      <Card>
        <Table
          dataSource={logs}
          columns={columns}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1000 }}
          pagination={{
            current: page,
            total,
            pageSize: 20,
            onChange: (p) => setPage(p),
            showTotal: (t) => `共 ${t} 条`,
          }}
        />
      </Card>
    </div>
  );
};
