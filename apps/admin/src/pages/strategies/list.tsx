/**
 * 策略列表页面
 * 策略管理 - 列表展示、上下架操作
 *
 * 已对接真实 API:
 * - GET /admin/strategies
 * - PUT /admin/strategies/:id
 * - DELETE /admin/strategies/:id
 */
import { useState, useEffect, useCallback } from 'react';
import { List, CreateButton, EditButton, ShowButton } from '@refinedev/antd';
import {
  Table,
  Space,
  Tag,
  Button,
  Modal,
  Tooltip,
  Avatar,
  Input,
  Spin,
  Alert,
  Row,
  Col,
} from 'antd';
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  ExclamationCircleOutlined,
  SearchOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { api } from '../../lib/api';
import { useMessage } from '../../hooks';

interface IStrategy {
  id: string;
  name: string;
  description: string | null;
  freqtradeId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  subscribersCount: number;
  signalsCount: number;
}

interface StrategyListResponse {
  items: IStrategy[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const StrategyList = () => {
  const message = useMessage();
  const [dataSource, setDataSource] = useState<IStrategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  // 获取策略列表
  const fetchStrategies = useCallback(async (page = 1, search = '', status = '') => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pagination.pageSize),
      });
      if (search) params.set('search', search);
      if (status) params.set('status', status);

      const data = await api.get<StrategyListResponse>(`/admin/strategies?${params.toString()}`);
      setDataSource(data.items);
      setPagination(prev => ({
        ...prev,
        current: data.page,
        total: data.total,
      }));
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '获取策略列表失败';
      setError(errorMessage);
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [pagination.pageSize]);

  useEffect(() => {
    fetchStrategies();
  }, [fetchStrategies]);

  // 搜索
  const handleSearch = () => {
    fetchStrategies(1, searchText, statusFilter);
  };

  // 重置
  const handleReset = () => {
    setSearchText('');
    setStatusFilter('');
    fetchStrategies(1, '', '');
  };

  // 分页变化
  const handleTableChange = (paginationConfig: { current?: number }) => {
    fetchStrategies(paginationConfig.current || 1, searchText, statusFilter);
  };

  // 上下架操作
  const handleStatusChange = async (strategy: IStrategy, newStatus: boolean) => {
    const actionText = newStatus ? '上架' : '下架';

    Modal.confirm({
      title: `确认${actionText}策略`,
      icon: <ExclamationCircleOutlined />,
      content: (
        <div>
          <p>
            确定要{actionText}策略 <strong>{strategy.name}</strong> 吗？
          </p>
          {!newStatus && strategy.subscribersCount > 0 && (
            <p style={{ color: '#f5222d' }}>
              ⚠️ 该策略有 {strategy.subscribersCount} 个活跃订阅，下架后订阅用户将停止接收信号！
            </p>
          )}
        </div>
      ),
      okText: '确认',
      cancelText: '取消',
      okButtonProps: { danger: !newStatus },
      async onOk() {
        try {
          await api.put(`/admin/strategies/${strategy.id}`, {
            isActive: newStatus,
          });
          message.success(`策略已${actionText}`);
          fetchStrategies(pagination.current, searchText, statusFilter);
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : `${actionText}失败`;
          message.error(errorMessage);
        }
      },
    });
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
      render: (id: string) => id.slice(0, 8) + '...',
    },
    {
      title: '策略',
      key: 'strategy',
      render: (_: unknown, record: IStrategy) => (
        <Space>
          <Avatar
            style={{
              backgroundColor: record.isActive ? '#52c41a' : '#d9d9d9',
            }}
          >
            {record.name.charAt(0)}
          </Avatar>
          <div>
            <div style={{ fontWeight: 500 }}>{record.name}</div>
            <div style={{ fontSize: 12, color: '#999' }}>
              ID: {record.freqtradeId}
            </div>
          </div>
        </Space>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      width: 200,
      ellipsis: true,
      render: (desc: string | null) => desc || '-',
    },
    {
      title: '状态',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 100,
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'success' : 'default'}>
          {isActive ? '运行中' : '已下架'}
        </Tag>
      ),
    },
    {
      title: '订阅数',
      dataIndex: 'subscribersCount',
      key: 'subscribersCount',
      width: 100,
      render: (count: number) => (
        <Tag color={count > 0 ? 'blue' : 'default'}>{count}</Tag>
      ),
      sorter: true,
    },
    {
      title: '信号数',
      dataIndex: 'signalsCount',
      key: 'signalsCount',
      width: 100,
      render: (count: number) => count.toLocaleString(),
      sorter: true,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (value: string) => new Date(value).toLocaleString('zh-CN'),
      sorter: true,
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (_: unknown, record: IStrategy) => (
        <Space>
          <ShowButton hideText size="small" recordItemId={record.id} />
          <EditButton hideText size="small" recordItemId={record.id} />
          {record.isActive ? (
            <Tooltip title="下架">
              <Button
                size="small"
                icon={<PauseCircleOutlined />}
                onClick={() => handleStatusChange(record, false)}
              />
            </Tooltip>
          ) : (
            <Tooltip title="上架">
              <Button
                size="small"
                type="primary"
                icon={<PlayCircleOutlined />}
                onClick={() => handleStatusChange(record, true)}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  return (
    <List
      title="策略管理"
      headerButtons={
        <Space>
          <Button
            icon={<ReloadOutlined spin={loading} />}
            onClick={() => fetchStrategies(pagination.current, searchText, statusFilter)}
          >
            刷新
          </Button>
          <CreateButton>新建策略</CreateButton>
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
            <Button size="small" onClick={() => fetchStrategies()}>重试</Button>
          }
        />
      )}

      {/* 搜索栏 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col flex="300px">
          <Input
            placeholder="搜索策略名称或描述"
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onPressEnter={handleSearch}
            allowClear
          />
        </Col>
        <Col>
          <Space>
            <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
              搜索
            </Button>
            <Button icon={<ReloadOutlined />} onClick={handleReset}>
              重置
            </Button>
          </Space>
        </Col>
      </Row>

      <Spin spinning={loading}>
        <Table
          dataSource={dataSource}
          columns={columns}
          rowKey="id"
          scroll={{ x: 1100 }}
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
