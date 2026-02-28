/**
 * 系统日志页面 - 审计日志（真实 API）
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
  Row,
  Col,
  Statistic,
  message,
  Modal,
  Empty,
} from 'antd';
import {
  SearchOutlined,
  DownloadOutlined,
  FileTextOutlined,
  UserOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import { useState, useEffect, useCallback } from 'react';
import { adminApi } from '../../lib/admin-api';

const { Title, Text, Paragraph } = Typography;
const { RangePicker } = DatePicker;

// 审计日志数据结构（与后端 AuditLog 对应）
interface IAuditLog {
  id: string;
  actorId: string;
  actorType: string;       // admin | system | user
  action: string;          // create | update | delete | login | approve | reject | …
  resourceType: string;    // user | strategy | withdrawal | config | staking | announcement | …
  resourceId: string | null;
  details: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

// actorType 标签颜色 + 中文
const actorTypeColor: Record<string, string> = {
  admin: 'red',
  system: 'blue',
  user: 'green',
};
const ACTOR_TYPE_LABEL: Record<string, string> = {
  admin: '管理员',
  system: '系统',
  user: '用户',
};

// action 标签颜色 + 中文
const actionColor: Record<string, string> = {
  create: 'green',
  update: 'blue',
  delete: 'red',
  login: 'cyan',
  approve: 'green',
  reject: 'red',
  execute: 'orange',
  pause: 'orange',
  resume: 'blue',
  cancel: 'gray',
};
const ACTION_LABEL: Record<string, string> = {
  create: '创建',
  update: '更新',
  delete: '删除',
  login: '登录',
  approve: '审批通过',
  reject: '审批拒绝',
  execute: '执行',
  pause: '暂停',
  resume: '恢复',
  cancel: '取消',
};

// resourceType 中文
const RESOURCE_TYPE_LABEL: Record<string, string> = {
  user: '用户',
  strategy: '策略',
  withdrawal: '提现',
  config: '系统配置',
  staking: '质押',
  announcement: '公告',
  api_key: 'API密钥',
  position: '持仓',
};

// 截断字符串，超出部分显示 …
function truncate(str: string | null | undefined, len: number): string {
  if (!str) return '-';
  return str.length > len ? str.slice(0, len) + '…' : str;
}

// 格式化日期
function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso;
  }
}

export const SystemLogsPage = () => {
  const [logs, setLogs] = useState<IAuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // 筛选状态
  const [search, setSearch] = useState('');
  const [actorType, setActorType] = useState('');
  const [resourceType, setResourceType] = useState('');
  const [dateRange, setDateRange] = useState<[string, string]>(['', '']);

  // 详情弹窗
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedLog, setSelectedLog] = useState<IAuditLog | null>(null);

  // 拉取日志
  const fetchLogs = useCallback(async (currentPage: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: String(pageSize),
        actorType: actorType,
        resourceType: resourceType,
        search: search,
        startDate: dateRange[0],
        endDate: dateRange[1],
      });

      const res = await adminApi.get<{ items: IAuditLog[]; total: number }>(
        `/admin/logs/system?${params.toString()}`
      );
      const responseData = res.data.data;
      setLogs(responseData.items ?? []);
      setTotal(responseData.total ?? 0);
    } catch (err) {
      console.error('获取系统日志失败:', err);
      message.error('获取日志失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [actorType, resourceType, search, dateRange]);

  // 筛选变更时重置到第一页并重新拉取
  useEffect(() => {
    setPage(1);
    fetchLogs(1);
  }, [fetchLogs]);

  // 打开详情弹窗
  const openDetail = (record: IAuditLog) => {
    setSelectedLog(record);
    setDetailVisible(true);
  };

  // 统计数据（从当前数据中派生，真实总数来自 total）
  const uniqueActorTypes = new Set(logs.map((l) => l.actorType)).size;
  const uniqueResourceTypes = new Set(logs.map((l) => l.resourceType)).size;

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
      title: '操作者',
      key: 'actor',
      width: 180,
      render: (_: unknown, record: IAuditLog) => (
        <Space direction="vertical" size={2}>
          <Tag color={actorTypeColor[record.actorType] ?? 'default'}>
            {ACTOR_TYPE_LABEL[record.actorType] ?? record.actorType}
          </Tag>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {truncate(record.actorId, 12)}
          </Text>
        </Space>
      ),
    },
    {
      title: '操作',
      dataIndex: 'action',
      key: 'action',
      width: 100,
      render: (action: string) => (
        <Tag color={actionColor[action] ?? 'default'}>{ACTION_LABEL[action] ?? action}</Tag>
      ),
    },
    {
      title: '资源类型',
      dataIndex: 'resourceType',
      key: 'resourceType',
      width: 120,
      render: (rt: string) => <Tag>{RESOURCE_TYPE_LABEL[rt] ?? rt}</Tag>,
    },
    {
      title: '资源ID',
      dataIndex: 'resourceId',
      key: 'resourceId',
      width: 110,
      render: (rid: string | null) =>
        rid ? (
          <Text code style={{ fontSize: 12 }}>
            {truncate(rid, 10)}
          </Text>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
    {
      title: '详情',
      dataIndex: 'details',
      key: 'details',
      render: (details: string | null, record: IAuditLog) => {
        const hasContent = details || record.metadata;
        return hasContent ? (
          <Space>
            <Text
              style={{
                maxWidth: 220,
                display: 'inline-block',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                verticalAlign: 'bottom',
              }}
            >
              {details ?? '（无文字详情）'}
            </Text>
            <Button
              type="link"
              size="small"
              style={{ padding: 0 }}
              onClick={() => openDetail(record)}
            >
              查看
            </Button>
          </Space>
        ) : (
          <Text type="secondary">-</Text>
        );
      },
    },
    {
      title: 'IP地址',
      dataIndex: 'ipAddress',
      key: 'ipAddress',
      width: 130,
      render: (ip: string | null) =>
        ip ? (
          <Text code style={{ fontSize: 12 }}>
            {ip}
          </Text>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (t: string) => (
        <Text style={{ fontSize: 12 }}>{formatDate(t)}</Text>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Title level={4} style={{ marginBottom: 24 }}>
        系统日志
      </Title>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card>
            <Statistic
              title="日志总数"
              value={total}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="操作者类型数"
              value={uniqueActorTypes}
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="资源类型数"
              value={uniqueResourceTypes}
              prefix={<AppstoreOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* 筛选栏 */}
      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input
            placeholder="搜索详情/资源ID"
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 200 }}
            allowClear
          />
          <Select
            placeholder="操作者类型"
            value={actorType || undefined}
            onChange={(v) => setActorType(v ?? '')}
            style={{ width: 130 }}
            allowClear
            options={[
              { value: 'admin', label: '管理员' },
              { value: 'system', label: '系统' },
              { value: 'user', label: '用户' },
            ]}
          />
          <Select
            placeholder="资源类型"
            value={resourceType || undefined}
            onChange={(v) => setResourceType(v ?? '')}
            style={{ width: 140 }}
            allowClear
            options={[
              { value: 'user', label: '用户' },
              { value: 'strategy', label: '策略' },
              { value: 'withdrawal', label: '提现' },
              { value: 'config', label: '系统配置' },
              { value: 'staking', label: '质押' },
              { value: 'announcement', label: '公告' },
              { value: 'api_key', label: 'API密钥' },
              { value: 'position', label: '持仓' },
            ]}
          />
          <RangePicker
            onChange={(_, strings) => {
              setDateRange([strings[0] ?? '', strings[1] ?? '']);
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

      {/* 日志表格 */}
      <Card>
        <Table
          dataSource={logs}
          columns={columns}
          rowKey="id"
          loading={loading}
          locale={{
            emptyText: <Empty description="暂无日志数据" />,
          }}
          pagination={{
            current: page,
            pageSize,
            total,
            showTotal: (t) => `共 ${t} 条`,
            onChange: (p) => {
              setPage(p);
              fetchLogs(p);
            },
          }}
          scroll={{ x: 1100 }}
        />
      </Card>

      {/* 详情弹窗 */}
      <Modal
        title="日志详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={
          <Button onClick={() => setDetailVisible(false)}>关闭</Button>
        }
        width={640}
      >
        {selectedLog && (
          <Space direction="vertical" style={{ width: '100%' }} size={16}>
            {selectedLog.details && (
              <div>
                <Text strong>详情文本</Text>
                <Paragraph
                  style={{
                    marginTop: 8,
                    padding: '8px 12px',
                    background: '#fafafa',
                    borderRadius: 4,
                    border: '1px solid #f0f0f0',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                  }}
                >
                  {selectedLog.details}
                </Paragraph>
              </div>
            )}
            {selectedLog.metadata && (
              <div>
                <Text strong>元数据 (metadata)</Text>
                <pre
                  style={{
                    marginTop: 8,
                    padding: '8px 12px',
                    background: '#f6f8fa',
                    borderRadius: 4,
                    border: '1px solid #e8e8e8',
                    fontSize: 12,
                    maxHeight: 320,
                    overflow: 'auto',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                  }}
                >
                  {JSON.stringify(selectedLog.metadata, null, 2)}
                </pre>
              </div>
            )}
            {!selectedLog.details && !selectedLog.metadata && (
              <Text type="secondary">无详细信息</Text>
            )}
          </Space>
        )}
      </Modal>
    </div>
  );
};
