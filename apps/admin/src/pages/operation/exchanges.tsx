/**
 * 交易所推荐管理页面
 * 管理前端展示的交易所列表
 */
import { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Space,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  Row,
  Col,
  Statistic,
  Tag,
  InputNumber,
  Alert,
  Image,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  EyeInvisibleOutlined,
  GlobalOutlined,
} from '@ant-design/icons';
import { api } from '../../lib/api';
import { useMessage } from '../../hooks';

const { TextArea } = Input;

interface Exchange {
  id: string;
  slug: string;
  name: string;
  logo: string;
  description: string;
  features: string[];
  affiliateUrl: string;
  status: 'supported' | 'coming_soon';
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ExchangeStats {
  total: number;
  active: number;
  comingSoon: number;
  inactive: number;
}

interface PaginatedResponse {
  items: Exchange[];
  total: number;
  page: number;
  limit: number;
}

export const ExchangeListPage = () => {
  const message = useMessage();
  const [dataSource, setDataSource] = useState<Exchange[]>([]);
  const [stats, setStats] = useState<ExchangeStats>({
    total: 0,
    active: 0,
    comingSoon: 0,
    inactive: 0,
  });
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Exchange | null>(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0 });
  const [searchText, setSearchText] = useState('');
  const [form] = Form.useForm();

  // 获取数据
  const fetchData = async (page = 1, limit = 10, search = '') => {
    setLoading(true);
    try {
      const [exchangesData, statsData] = await Promise.all([
        api.get<PaginatedResponse>(
          `/admin/exchanges?page=${page}&limit=${limit}&search=${search}`
        ),
        api.get<ExchangeStats>('/admin/exchanges/stats'),
      ]);

      setDataSource(exchangesData.items || []);
      setPagination({
        page: exchangesData.page || page,
        limit: exchangesData.limit || limit,
        total: exchangesData.total || 0,
      });
      setStats(statsData || { total: 0, active: 0, comingSoon: 0, inactive: 0 });
    } catch (err) {
      console.error('获取数据失败:', err);
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRefresh = () => {
    fetchData(pagination.page, pagination.limit, searchText);
  };

  const handleCreate = () => {
    setEditingItem(null);
    form.resetFields();
    form.setFieldsValue({
      status: 'supported',
      sortOrder: 100,
      isActive: true,
      features: [],
    });
    setIsModalOpen(true);
  };

  const handleEdit = (record: Exchange) => {
    setEditingItem(record);
    form.setFieldsValue({
      ...record,
      features: record.features.join(', '),
    });
    setIsModalOpen(true);
  };

  const handleDelete = (record: Exchange) => {
    Modal.confirm({
      title: '确认删除',
      icon: <ExclamationCircleOutlined />,
      content: `确定要删除交易所「${record.name}」吗？`,
      okText: '确认',
      cancelText: '取消',
      okButtonProps: { danger: true },
      async onOk() {
        try {
          await api.delete(`/admin/exchanges/${record.id}`);
          message.success('已删除');
          fetchData(pagination.page, pagination.limit, searchText);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '删除失败';
          message.error(`删除失败: ${errorMessage}`);
        }
      },
    });
  };

  const handleToggleActive = async (record: Exchange) => {
    try {
      await api.put(`/admin/exchanges/${record.id}`, {
        isActive: !record.isActive,
      });

      setDataSource((prev) =>
        prev.map((item) =>
          item.id === record.id ? { ...item, isActive: !item.isActive } : item
        )
      );

      // 更新统计数据
      setStats((prev) => ({
        ...prev,
        active: prev.active + (record.isActive ? -1 : 1),
        inactive: prev.inactive + (record.isActive ? 1 : -1),
      }));

      message.success(record.isActive ? '已隐藏' : '已启用');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '更新失败';
      message.error(`更新失败: ${errorMessage}`);
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      // 处理 features: "现货, 合约, 杠杆" -> ["现货", "合约", "杠杆"]
      const features =
        typeof values.features === 'string'
          ? values.features.split(',').map((f: string) => f.trim()).filter(Boolean)
          : values.features || [];

      const formData = {
        ...values,
        features,
      };

      if (editingItem) {
        await api.put(`/admin/exchanges/${editingItem.id}`, formData);
        message.success('已更新');
      } else {
        await api.post('/admin/exchanges', formData);
        message.success('已添加');
      }

      setIsModalOpen(false);
      fetchData(pagination.page, pagination.limit, searchText);
    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };

  const handleSearch = (value: string) => {
    setSearchText(value);
    fetchData(1, pagination.limit, value);
  };

  const handleTableChange = (pag: any) => {
    fetchData(pag.current, pag.pageSize, searchText);
  };

  const columns: ColumnsType<Exchange> = [
    {
      title: 'Logo + 名称',
      key: 'name',
      width: 200,
      render: (_, record) => (
        <Space>
          {record.logo ? (
            <Image
              src={record.logo}
              alt={record.name}
              width={32}
              height={32}
              style={{ borderRadius: 4 }}
              preview={false}
            />
          ) : (
            <GlobalOutlined style={{ fontSize: 32, color: '#666' }} />
          )}
          <div>
            <div style={{ fontWeight: 500 }}>{record.name}</div>
            <div style={{ fontSize: 12, color: '#666' }}>{record.slug}</div>
          </div>
        </Space>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '特性',
      dataIndex: 'features',
      key: 'features',
      width: 200,
      render: (features: string[]) =>
        features && features.length > 0 ? (
          <Space wrap>
            {features.map((feature, index) => (
              <Tag key={index} color="blue">
                {feature}
              </Tag>
            ))}
          </Space>
        ) : (
          <span style={{ color: '#999' }}>-</span>
        ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: string) => {
        const statusConfig = {
          supported: { text: '已上线', color: 'success', icon: <CheckCircleOutlined /> },
          coming_soon: { text: '即将上线', color: 'warning', icon: <ClockCircleOutlined /> },
        };
        const config = statusConfig[status as keyof typeof statusConfig] || {
          text: status,
          color: 'default',
          icon: null,
        };
        return (
          <Tag icon={config.icon} color={config.color}>
            {config.text}
          </Tag>
        );
      },
    },
    {
      title: '排序',
      dataIndex: 'sortOrder',
      key: 'sortOrder',
      width: 80,
      align: 'center',
    },
    {
      title: '启用',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 80,
      align: 'center',
      render: (isActive: boolean, record: Exchange) => (
        <Switch
          checked={isActive}
          onChange={() => handleToggleActive(record)}
          checkedChildren="显示"
          unCheckedChildren="隐藏"
        />
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      align: 'center',
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          <Button
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record)}
          />
        </Space>
      ),
    },
  ];

  return (
    <div>
      {/* 标题栏 */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: 24 }}>交易所推荐管理</h2>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={handleRefresh}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            新增交易所
          </Button>
        </Space>
      </div>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总数"
              value={stats.total}
              prefix={<GlobalOutlined />}
              valueStyle={{ color: '#06B6D4' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已上线"
              value={stats.active}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#22C55E' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="即将上线"
              value={stats.comingSoon}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#F59E0B' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已隐藏"
              value={stats.inactive}
              prefix={<EyeInvisibleOutlined />}
              valueStyle={{ color: '#94A3B8' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 搜索栏 */}
      <Card style={{ marginBottom: 16 }}>
        <Input.Search
          placeholder="搜索交易所名称或 Slug"
          allowClear
          enterButton="搜索"
          onSearch={handleSearch}
          style={{ width: 400 }}
        />
      </Card>

      {/* 表格 */}
      <Card>
        <Table
          dataSource={dataSource}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{
            current: pagination.page,
            pageSize: pagination.limit,
            total: pagination.total,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
          }}
          onChange={handleTableChange}
        />
      </Card>

      {/* 新增/编辑弹窗 */}
      <Modal
        title={editingItem ? '编辑交易所' : '新增交易所'}
        open={isModalOpen}
        onOk={handleSubmit}
        onCancel={() => setIsModalOpen(false)}
        width={700}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Alert
            message="提示"
            description="交易所信息将展示在前端「交易所」页面，用于推荐用户注册交易所账户"
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Slug"
                name="slug"
                rules={[
                  { required: true, message: '请输入 Slug' },
                  { pattern: /^[a-z0-9-]+$/, message: '只能包含小写字母、数字和连字符' },
                ]}
                extra="唯一标识，如: binance, okx, bybit"
              >
                <Input placeholder="binance" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="名称"
                name="name"
                rules={[{ required: true, message: '请输入名称' }]}
              >
                <Input placeholder="币安" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="Logo 地址" name="logo">
            <Input placeholder="https://example.com/logo.png" />
          </Form.Item>

          <Form.Item
            label="描述"
            name="description"
            rules={[{ required: true, message: '请输入描述' }]}
          >
            <TextArea
              rows={3}
              placeholder="全球最大的加密货币交易所..."
              showCount
              maxLength={200}
            />
          </Form.Item>

          <Form.Item
            label="特性标签"
            name="features"
            extra="多个特性用逗号分隔，如: 现货, 合约, 杠杆"
          >
            <Input placeholder="现货, 合约, 杠杆" />
          </Form.Item>

          <Form.Item
            label="推广链接"
            name="affiliateUrl"
            rules={[{ required: true, message: '请输入推广链接' }]}
          >
            <Input placeholder="https://www.binance.com/zh-CN/register?ref=..." />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="状态"
                name="status"
                rules={[{ required: true, message: '请选择状态' }]}
              >
                <Select
                  options={[
                    { label: '已上线', value: 'supported' },
                    { label: '即将上线', value: 'coming_soon' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="排序"
                name="sortOrder"
                rules={[{ required: true, message: '请输入排序' }]}
                extra="数值越小越靠前"
              >
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="是否启用" name="isActive" valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="隐藏" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
