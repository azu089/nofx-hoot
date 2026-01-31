/**
 * 公告管理页面
 * 公告列表、发布、编辑
 */
import { useState } from 'react';
import { List } from '@refinedev/antd';
import {
  Table,
  Tag,
  Space,
  Button,
  Modal,
  message,
  Switch,
  Tooltip,
  Form,
  Input,
  Select,
  DatePicker,
} from 'antd';
import {
  EditOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { TextArea } = Input;

interface IAnnouncement {
  id: string;
  title: string;
  content: string;
  type: 'system' | 'activity' | 'maintenance' | 'urgent';
  position: string[];
  status: 'draft' | 'published' | 'offline';
  publishAt: string;
  expireAt: string;
  priority: number;
  createdAt: string;
}

// 模拟数据
const mockAnnouncements: IAnnouncement[] = [
  {
    id: '1',
    title: '系统升级通知',
    content: '系统将于今晚 23:00-01:00 进行升级维护，届时部分功能可能受影响。',
    type: 'maintenance',
    position: ['home', 'popup'],
    status: 'published',
    publishAt: '2025-01-30 10:00',
    expireAt: '2025-02-01 00:00',
    priority: 10,
    createdAt: '2025-01-30 09:00',
  },
  {
    id: '2',
    title: '新年活动：充值送 HOOT',
    content: '活动期间充值满 100 USDT 送 500 HOOT，多充多送！',
    type: 'activity',
    position: ['home', 'popup', 'marquee'],
    status: 'published',
    publishAt: '2025-01-25 00:00',
    expireAt: '2025-02-10 23:59',
    priority: 5,
    createdAt: '2025-01-24 15:00',
  },
  {
    id: '3',
    title: '关于异常交易的说明',
    content: '近期发现部分异常交易行为，平台已进行处理。',
    type: 'system',
    position: ['home'],
    status: 'offline',
    publishAt: '2025-01-20 10:00',
    expireAt: '2025-01-25 10:00',
    priority: 1,
    createdAt: '2025-01-20 09:00',
  },
  {
    id: '4',
    title: '紧急：BTC 行情异动提醒',
    content: 'BTC 短时剧烈波动，请注意风险控制。',
    type: 'urgent',
    position: ['popup', 'marquee'],
    status: 'draft',
    publishAt: '',
    expireAt: '',
    priority: 100,
    createdAt: '2025-01-30 14:00',
  },
];

export const AnnouncementList = () => {
  const [dataSource, setDataSource] = useState<IAnnouncement[]>(mockAnnouncements);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<IAnnouncement | null>(null);
  const [form] = Form.useForm();

  const typeConfig = {
    system: { color: 'blue', label: '系统公告' },
    activity: { color: 'green', label: '活动公告' },
    maintenance: { color: 'orange', label: '维护公告' },
    urgent: { color: 'red', label: '紧急公告' },
  };

  const statusConfig = {
    draft: { color: 'default', label: '草稿' },
    published: { color: 'success', label: '已发布' },
    offline: { color: 'error', label: '已下线' },
  };

  const positionLabels: Record<string, string> = {
    home: '首页',
    popup: '弹窗',
    marquee: '跑马灯',
  };

  const handleCreate = () => {
    setEditingItem(null);
    form.resetFields();
    setIsModalOpen(true);
  };

  const handleEdit = (record: IAnnouncement) => {
    setEditingItem(record);
    form.setFieldsValue({
      ...record,
      publishAt: record.publishAt ? dayjs(record.publishAt) : null,
      expireAt: record.expireAt ? dayjs(record.expireAt) : null,
    });
    setIsModalOpen(true);
  };

  const handleDelete = (record: IAnnouncement) => {
    Modal.confirm({
      title: '确认删除',
      icon: <ExclamationCircleOutlined />,
      content: `确定要删除公告「${record.title}」吗？`,
      okText: '确认',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk() {
        setDataSource((prev) => prev.filter((item) => item.id !== record.id));
        message.success('公告已删除');
      },
    });
  };

  const handleToggleStatus = (record: IAnnouncement) => {
    const newStatus = record.status === 'published' ? 'offline' : 'published';
    setDataSource((prev) =>
      prev.map((item) =>
        item.id === record.id ? { ...item, status: newStatus } : item
      )
    );
    message.success(newStatus === 'published' ? '公告已发布' : '公告已下线');
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const formData = {
        ...values,
        publishAt: values.publishAt?.format('YYYY-MM-DD HH:mm') || '',
        expireAt: values.expireAt?.format('YYYY-MM-DD HH:mm') || '',
      };

      if (editingItem) {
        setDataSource((prev) =>
          prev.map((item) =>
            item.id === editingItem.id ? { ...item, ...formData } : item
          )
        );
        message.success('公告已更新');
      } else {
        const newItem: IAnnouncement = {
          ...formData,
          id: Date.now().toString(),
          status: 'draft',
          createdAt: dayjs().format('YYYY-MM-DD HH:mm'),
        };
        setDataSource((prev) => [newItem, ...prev]);
        message.success('公告已创建');
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 60,
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (type: keyof typeof typeConfig) => (
        <Tag color={typeConfig[type].color}>{typeConfig[type].label}</Tag>
      ),
    },
    {
      title: '展示位置',
      dataIndex: 'position',
      key: 'position',
      width: 180,
      render: (positions: string[]) => (
        <Space wrap>
          {positions.map((pos) => (
            <Tag key={pos}>{positionLabels[pos]}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: keyof typeof statusConfig, record: IAnnouncement) => (
        <Space>
          <Tag color={statusConfig[status].color}>
            {statusConfig[status].label}
          </Tag>
          {status !== 'draft' && (
            <Switch
              size="small"
              checked={status === 'published'}
              onChange={() => handleToggleStatus(record)}
            />
          )}
        </Space>
      ),
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 80,
      sorter: (a: IAnnouncement, b: IAnnouncement) => b.priority - a.priority,
    },
    {
      title: '发布时间',
      dataIndex: 'publishAt',
      key: 'publishAt',
      width: 150,
      render: (time: string) => time || '-',
    },
    {
      title: '过期时间',
      dataIndex: 'expireAt',
      key: 'expireAt',
      width: 150,
      render: (time: string) => time || '-',
    },
    {
      title: '操作',
      key: 'actions',
      width: 150,
      render: (_: unknown, record: IAnnouncement) => (
        <Space>
          <Tooltip title="预览">
            <Button size="small" icon={<EyeOutlined />} />
          </Tooltip>
          <Tooltip title="编辑">
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
          <Tooltip title="删除">
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(record)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <List
      headerButtons={
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          新建公告
        </Button>
      }
    >
      <Table
        dataSource={dataSource}
        columns={columns}
        rowKey="id"
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条`,
        }}
      />

      <Modal
        title={editingItem ? '编辑公告' : '新建公告'}
        open={isModalOpen}
        onOk={handleSubmit}
        onCancel={() => setIsModalOpen(false)}
        width={700}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="标题"
            name="title"
            rules={[{ required: true, message: '请输入标题' }]}
          >
            <Input placeholder="请输入公告标题" maxLength={100} />
          </Form.Item>

          <Form.Item
            label="内容"
            name="content"
            rules={[{ required: true, message: '请输入内容' }]}
          >
            <TextArea rows={4} placeholder="请输入公告内容" maxLength={500} showCount />
          </Form.Item>

          <Space size="large">
            <Form.Item
              label="类型"
              name="type"
              rules={[{ required: true, message: '请选择类型' }]}
            >
              <Select
                style={{ width: 150 }}
                options={[
                  { label: '系统公告', value: 'system' },
                  { label: '活动公告', value: 'activity' },
                  { label: '维护公告', value: 'maintenance' },
                  { label: '紧急公告', value: 'urgent' },
                ]}
              />
            </Form.Item>

            <Form.Item
              label="优先级"
              name="priority"
              initialValue={1}
            >
              <Select
                style={{ width: 120 }}
                options={[
                  { label: '低', value: 1 },
                  { label: '中', value: 5 },
                  { label: '高', value: 10 },
                  { label: '紧急', value: 100 },
                ]}
              />
            </Form.Item>
          </Space>

          <Form.Item
            label="展示位置"
            name="position"
            rules={[{ required: true, message: '请选择展示位置' }]}
          >
            <Select
              mode="multiple"
              style={{ width: '100%' }}
              placeholder="可多选"
              options={[
                { label: '首页', value: 'home' },
                { label: '弹窗', value: 'popup' },
                { label: '跑马灯', value: 'marquee' },
              ]}
            />
          </Form.Item>

          <Space size="large">
            <Form.Item label="发布时间" name="publishAt">
              <DatePicker showTime placeholder="留空立即发布" />
            </Form.Item>

            <Form.Item label="过期时间" name="expireAt">
              <DatePicker showTime placeholder="留空永不过期" />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </List>
  );
};
