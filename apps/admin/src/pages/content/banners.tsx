/**
 * Banner 管理页面
 * 首页轮播图配置
 */
import { List } from '@refinedev/antd';
import {
  Table,
  Tag,
  Space,
  Button,
  Card,
  Image,
  Switch,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Upload,
  Typography,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  UploadOutlined,
  EyeOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
} from '@ant-design/icons';
import { useState } from 'react';
import { useMessage, useModal } from '../../hooks';

const { Text } = Typography;

interface IBanner {
  id: string;
  title: string;
  imageUrl: string;
  linkUrl: string;
  linkType: 'internal' | 'external' | 'none';
  position: 'home' | 'strategy' | 'wallet';
  sort: number;
  status: 'active' | 'inactive';
  startTime: string;
  endTime: string;
  createdAt: string;
}

// 生成 SVG 占位图
const createPlaceholderSvg = (color: string, text: string) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="300"><rect fill="${color}" width="100%" height="100%"/><text fill="#fff" font-family="Arial" font-size="32" x="50%" y="50%" text-anchor="middle" dy=".3em">${text}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

// 模拟数据
const mockBanners: IBanner[] = [
  {
    id: '1',
    title: '春节活动 - 新用户福利',
    imageUrl: createPlaceholderSvg('#1890ff', 'Spring Festival'),
    linkUrl: '/activity/spring-2025',
    linkType: 'internal',
    position: 'home',
    sort: 1,
    status: 'active',
    startTime: '2025-01-20 00:00:00',
    endTime: '2025-02-15 23:59:59',
    createdAt: '2025-01-15 10:00:00',
  },
  {
    id: '2',
    title: 'HOOT 质押收益提升',
    imageUrl: createPlaceholderSvg('#722ed1', 'HOOT Staking'),
    linkUrl: '/staking',
    linkType: 'internal',
    position: 'home',
    sort: 2,
    status: 'active',
    startTime: '2025-01-01 00:00:00',
    endTime: '2025-12-31 23:59:59',
    createdAt: '2025-01-01 00:00:00',
  },
  {
    id: '3',
    title: '策略市场上新',
    imageUrl: createPlaceholderSvg('#52c41a', 'New Strategies'),
    linkUrl: '/strategies',
    linkType: 'internal',
    position: 'strategy',
    sort: 1,
    status: 'active',
    startTime: '2025-01-25 00:00:00',
    endTime: '2025-03-01 23:59:59',
    createdAt: '2025-01-25 09:00:00',
  },
  {
    id: '4',
    title: '已过期活动',
    imageUrl: createPlaceholderSvg('#999999', 'Expired'),
    linkUrl: '/old-activity',
    linkType: 'internal',
    position: 'home',
    sort: 99,
    status: 'inactive',
    startTime: '2024-12-01 00:00:00',
    endTime: '2024-12-31 23:59:59',
    createdAt: '2024-12-01 00:00:00',
  },
];

export const BannersPage = () => {
  const message = useMessage();
  const modal = useModal();
  const [dataSource, setDataSource] = useState<IBanner[]>(mockBanners);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingBanner, setEditingBanner] = useState<IBanner | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewImage, setPreviewImage] = useState('');
  const [form] = Form.useForm();

  const positionLabels = {
    home: '首页',
    strategy: '策略页',
    wallet: '钱包页',
  };

  const positionColors = {
    home: 'blue',
    strategy: 'green',
    wallet: 'purple',
  };

  const handleAdd = () => {
    setEditingBanner(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record: IBanner) => {
    setEditingBanner(record);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleDelete = (record: IBanner) => {
    modal.confirm({
      title: '确认删除',
      content: `确定要删除 Banner "${record.title}" 吗？`,
      okText: '删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk() {
        setDataSource(prev => prev.filter(item => item.id !== record.id));
        message.success('删除成功');
      },
    });
  };

  const handleStatusChange = (record: IBanner, checked: boolean) => {
    setDataSource(prev =>
      prev.map(item =>
        item.id === record.id
          ? { ...item, status: checked ? 'active' : 'inactive' }
          : item
      )
    );
    message.success(checked ? '已启用' : '已禁用');
  };

  const handleMoveUp = (record: IBanner) => {
    const index = dataSource.findIndex(item => item.id === record.id);
    if (index > 0) {
      const newData = [...dataSource];
      [newData[index - 1], newData[index]] = [newData[index], newData[index - 1]];
      // 更新排序值
      newData.forEach((item, i) => {
        item.sort = i + 1;
      });
      setDataSource(newData);
      message.success('已上移');
    }
  };

  const handleMoveDown = (record: IBanner) => {
    const index = dataSource.findIndex(item => item.id === record.id);
    if (index < dataSource.length - 1) {
      const newData = [...dataSource];
      [newData[index], newData[index + 1]] = [newData[index + 1], newData[index]];
      // 更新排序值
      newData.forEach((item, i) => {
        item.sort = i + 1;
      });
      setDataSource(newData);
      message.success('已下移');
    }
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      if (editingBanner) {
        // 编辑
        setDataSource(prev =>
          prev.map(item =>
            item.id === editingBanner.id ? { ...item, ...values } : item
          )
        );
        message.success('更新成功');
      } else {
        // 新增
        const newBanner: IBanner = {
          id: String(Date.now()),
          ...values,
          status: 'active',
          createdAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
        };
        setDataSource(prev => [...prev, newBanner]);
        message.success('添加成功');
      }
      setModalVisible(false);
    } catch (error) {
      console.error('验证失败:', error);
    }
  };

  const columns = [
    {
      title: '排序',
      dataIndex: 'sort',
      key: 'sort',
      width: 80,
      render: (sort: number) => (
        <Tag>{sort}</Tag>
      ),
    },
    {
      title: '预览',
      dataIndex: 'imageUrl',
      key: 'imageUrl',
      width: 160,
      render: (url: string) => (
        <Image
          src={url}
          width={140}
          height={52}
          style={{ objectFit: 'cover', borderRadius: 4 }}
          preview={{
            visible: previewVisible && previewImage === url,
            onVisibleChange: (visible) => {
              setPreviewVisible(visible);
              if (visible) setPreviewImage(url);
            },
          }}
        />
      ),
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      width: 200,
      render: (title: string) => (
        <Text ellipsis={{ tooltip: title }} style={{ maxWidth: 180 }}>
          {title}
        </Text>
      ),
    },
    {
      title: '位置',
      dataIndex: 'position',
      key: 'position',
      width: 100,
      render: (position: keyof typeof positionLabels) => (
        <Tag color={positionColors[position]}>{positionLabels[position]}</Tag>
      ),
      filters: [
        { text: '首页', value: 'home' },
        { text: '策略页', value: 'strategy' },
        { text: '钱包页', value: 'wallet' },
      ],
      onFilter: (value: unknown, record: IBanner) => record.position === value,
    },
    {
      title: '链接类型',
      dataIndex: 'linkType',
      key: 'linkType',
      width: 100,
      render: (type: string) => {
        const labels = { internal: '站内', external: '站外', none: '无' };
        const colors = { internal: 'blue', external: 'orange', none: 'default' };
        return <Tag color={colors[type as keyof typeof colors]}>{labels[type as keyof typeof labels]}</Tag>;
      },
    },
    {
      title: '有效期',
      key: 'period',
      width: 200,
      render: (_: unknown, record: IBanner) => (
        <div style={{ fontSize: 12 }}>
          <div>{record.startTime.slice(0, 10)}</div>
          <div>至 {record.endTime.slice(0, 10)}</div>
        </div>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string, record: IBanner) => (
        <Switch
          checked={status === 'active'}
          onChange={(checked) => handleStatusChange(record, checked)}
          checkedChildren="启用"
          unCheckedChildren="禁用"
        />
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (_: unknown, record: IBanner) => (
        <Space>
          <Button
            size="small"
            icon={<ArrowUpOutlined />}
            onClick={() => handleMoveUp(record)}
            disabled={dataSource.indexOf(record) === 0}
          />
          <Button
            size="small"
            icon={<ArrowDownOutlined />}
            onClick={() => handleMoveDown(record)}
            disabled={dataSource.indexOf(record) === dataSource.length - 1}
          />
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => {
              setPreviewImage(record.imageUrl);
              setPreviewVisible(true);
            }}
          />
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          />
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
    <List
      headerButtons={
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          添加 Banner
        </Button>
      }
    >
      <Card style={{ marginBottom: 16 }}>
        <Text type="secondary">
          提示：Banner 将按排序值从小到大显示。建议图片尺寸：800x300 像素，支持 JPG/PNG 格式。
        </Text>
      </Card>

      <Table
        dataSource={dataSource}
        columns={columns}
        rowKey="id"
        scroll={{ x: 1100 }}
        pagination={{
          pageSize: 10,
          showTotal: (total) => `共 ${total} 条`,
        }}
      />

      {/* 编辑/新增 Modal */}
      <Modal
        title={editingBanner ? '编辑 Banner' : '添加 Banner'}
        open={modalVisible}
        onOk={handleModalOk}
        onCancel={() => setModalVisible(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="标题"
            name="title"
            rules={[{ required: true, message: '请输入标题' }]}
          >
            <Input placeholder="Banner 标题" />
          </Form.Item>

          <Form.Item
            label="图片"
            name="imageUrl"
            rules={[{ required: true, message: '请上传图片' }]}
          >
            <Input placeholder="图片 URL 或上传" addonAfter={
              <Upload showUploadList={false}>
                <UploadOutlined />
              </Upload>
            } />
          </Form.Item>

          <Form.Item
            label="显示位置"
            name="position"
            rules={[{ required: true, message: '请选择显示位置' }]}
          >
            <Select
              options={[
                { label: '首页', value: 'home' },
                { label: '策略页', value: 'strategy' },
                { label: '钱包页', value: 'wallet' },
              ]}
            />
          </Form.Item>

          <Form.Item
            label="链接类型"
            name="linkType"
            rules={[{ required: true, message: '请选择链接类型' }]}
          >
            <Select
              options={[
                { label: '站内链接', value: 'internal' },
                { label: '站外链接', value: 'external' },
                { label: '无链接', value: 'none' },
              ]}
            />
          </Form.Item>

          <Form.Item
            label="链接地址"
            name="linkUrl"
          >
            <Input placeholder="点击跳转的链接地址" />
          </Form.Item>

          <Form.Item
            label="排序"
            name="sort"
            rules={[{ required: true, message: '请输入排序值' }]}
          >
            <InputNumber min={1} max={99} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            label="开始时间"
            name="startTime"
            rules={[{ required: true, message: '请选择开始时间' }]}
          >
            <Input type="datetime-local" />
          </Form.Item>

          <Form.Item
            label="结束时间"
            name="endTime"
            rules={[{ required: true, message: '请选择结束时间' }]}
          >
            <Input type="datetime-local" />
          </Form.Item>
        </Form>
      </Modal>
    </List>
  );
};
