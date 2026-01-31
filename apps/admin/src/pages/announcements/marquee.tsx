/**
 * 跑马灯管理页面
 * 滚动公告配置
 */
import { useState } from 'react';
import { List } from '@refinedev/antd';
import {
  Table,
  Space,
  Button,
  Modal,
  message,
  Switch,
  Form,
  Input,
  ColorPicker,
  Card,
  Alert,
} from 'antd';
import {
  EditOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
  PlusOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
} from '@ant-design/icons';
import type { Color } from 'antd/es/color-picker';

interface IMarquee {
  id: string;
  content: string;
  link: string;
  order: number;
  enabled: boolean;
  bgColor: string;
  textColor: string;
}

// 模拟数据
const mockMarquees: IMarquee[] = [
  {
    id: '1',
    content: '🎉 新年活动：充值送 HOOT，多充多送！点击查看详情',
    link: '/announcements/2',
    order: 1,
    enabled: true,
    bgColor: '#06B6D4',
    textColor: '#FFFFFF',
  },
  {
    id: '2',
    content: '⚠️ 系统将于今晚 23:00 进行升级维护',
    link: '',
    order: 2,
    enabled: true,
    bgColor: '#F59E0B',
    textColor: '#000000',
  },
  {
    id: '3',
    content: '📈 AI量化策略Alpha 本月收益 +12.5%',
    link: '/strategies/1',
    order: 3,
    enabled: false,
    bgColor: '#22C55E',
    textColor: '#FFFFFF',
  },
];

export const MarqueeList = () => {
  const [dataSource, setDataSource] = useState<IMarquee[]>(mockMarquees);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<IMarquee | null>(null);
  const [form] = Form.useForm();

  const handleCreate = () => {
    setEditingItem(null);
    form.resetFields();
    form.setFieldsValue({
      bgColor: '#06B6D4',
      textColor: '#FFFFFF',
    });
    setIsModalOpen(true);
  };

  const handleEdit = (record: IMarquee) => {
    setEditingItem(record);
    form.setFieldsValue(record);
    setIsModalOpen(true);
  };

  const handleDelete = (record: IMarquee) => {
    Modal.confirm({
      title: '确认删除',
      icon: <ExclamationCircleOutlined />,
      content: '确定要删除这条跑马灯吗？',
      okText: '确认',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk() {
        setDataSource((prev) => prev.filter((item) => item.id !== record.id));
        message.success('已删除');
      },
    });
  };

  const handleToggle = (record: IMarquee) => {
    setDataSource((prev) =>
      prev.map((item) =>
        item.id === record.id ? { ...item, enabled: !item.enabled } : item
      )
    );
  };

  const handleMove = (record: IMarquee, direction: 'up' | 'down') => {
    const index = dataSource.findIndex((item) => item.id === record.id);
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === dataSource.length - 1)
    ) {
      return;
    }

    const newData = [...dataSource];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    [newData[index], newData[swapIndex]] = [newData[swapIndex], newData[index]];

    // 更新顺序
    newData.forEach((item, i) => {
      item.order = i + 1;
    });

    setDataSource(newData);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const formData = {
        ...values,
        bgColor: typeof values.bgColor === 'string' ? values.bgColor : (values.bgColor as Color).toHexString(),
        textColor: typeof values.textColor === 'string' ? values.textColor : (values.textColor as Color).toHexString(),
      };

      if (editingItem) {
        setDataSource((prev) =>
          prev.map((item) =>
            item.id === editingItem.id ? { ...item, ...formData } : item
          )
        );
        message.success('已更新');
      } else {
        const newItem: IMarquee = {
          ...formData,
          id: Date.now().toString(),
          order: dataSource.length + 1,
          enabled: true,
        };
        setDataSource((prev) => [...prev, newItem]);
        message.success('已添加');
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };

  const columns = [
    {
      title: '顺序',
      dataIndex: 'order',
      key: 'order',
      width: 80,
    },
    {
      title: '内容',
      dataIndex: 'content',
      key: 'content',
      render: (content: string, record: IMarquee) => (
        <div
          style={{
            padding: '4px 8px',
            borderRadius: 4,
            backgroundColor: record.bgColor,
            color: record.textColor,
            fontSize: 13,
          }}
        >
          {content}
        </div>
      ),
    },
    {
      title: '跳转链接',
      dataIndex: 'link',
      key: 'link',
      width: 200,
      ellipsis: true,
      render: (link: string) => link || <span style={{ color: '#666' }}>-</span>,
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 100,
      render: (enabled: boolean, record: IMarquee) => (
        <Switch checked={enabled} onChange={() => handleToggle(record)} />
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 180,
      render: (_: unknown, record: IMarquee, index: number) => (
        <Space>
          <Button
            size="small"
            icon={<ArrowUpOutlined />}
            disabled={index === 0}
            onClick={() => handleMove(record, 'up')}
          />
          <Button
            size="small"
            icon={<ArrowDownOutlined />}
            disabled={index === dataSource.length - 1}
            onClick={() => handleMove(record, 'down')}
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

  // 预览效果
  const enabledMarquees = dataSource.filter((m) => m.enabled);

  return (
    <List
      headerButtons={
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          添加跑马灯
        </Button>
      }
    >
      {/* 预览区域 */}
      {enabledMarquees.length > 0 && (
        <Card title="预览效果" style={{ marginBottom: 16 }}>
          <div style={{ overflow: 'hidden' }}>
            {enabledMarquees.map((item) => (
              <div
                key={item.id}
                style={{
                  padding: '8px 16px',
                  marginBottom: 8,
                  borderRadius: 4,
                  backgroundColor: item.bgColor,
                  color: item.textColor,
                }}
              >
                {item.content}
              </div>
            ))}
          </div>
        </Card>
      )}

      <Alert
        message="跑马灯将按顺序循环显示在前端页面顶部"
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Table
        dataSource={dataSource}
        columns={columns}
        rowKey="id"
        pagination={false}
      />

      <Modal
        title={editingItem ? '编辑跑马灯' : '添加跑马灯'}
        open={isModalOpen}
        onOk={handleSubmit}
        onCancel={() => setIsModalOpen(false)}
        width={600}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="内容"
            name="content"
            rules={[{ required: true, message: '请输入内容' }]}
          >
            <Input placeholder="请输入跑马灯内容（支持 emoji）" maxLength={100} />
          </Form.Item>

          <Form.Item label="跳转链接" name="link">
            <Input placeholder="点击后跳转的链接（留空则不跳转）" />
          </Form.Item>

          <Space size="large">
            <Form.Item label="背景色" name="bgColor">
              <ColorPicker showText />
            </Form.Item>

            <Form.Item label="文字色" name="textColor">
              <ColorPicker showText />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </List>
  );
};
