/**
 * FAQ 常见问题管理页面
 * 连接真实后端 API
 */
import { useState, useEffect, useCallback } from 'react';
import { List } from '@refinedev/antd';
import {
  Table,
  Tag,
  Space,
  Button,
  Modal,
  Form,
  Input,
  Switch,
  Card,
  Typography,
  Tabs,
  Select,
  InputNumber,
  Popconfirm,
  Row,
  Col,
  Spin,
  Alert,
} from 'antd';
import {
  EditOutlined,
  PlusOutlined,
  DeleteOutlined,
  QuestionCircleOutlined,
  ExpandAltOutlined,
  ShrinkOutlined,
  ReloadOutlined,
  TranslationOutlined,
} from '@ant-design/icons';
import { adminApi } from '../../lib/admin-api';
import { useMessage } from '../../hooks';

const { Text } = Typography;
const { TextArea } = Input;

interface IFaqItem {
  id: string;
  questionZh: string;
  questionEn: string;
  answerZh: string;
  answerEn: string;
  category: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// 分类配置
const categoryOptions = [
  { value: 'general', label: '通用问题', color: 'blue' },
  { value: 'account', label: '账户相关', color: 'green' },
  { value: 'trading', label: '交易相关', color: 'orange' },
  { value: 'wallet', label: '钱包相关', color: 'purple' },
  { value: 'strategy', label: '策略相关', color: 'cyan' },
  { value: 'security', label: '安全相关', color: 'red' },
];

export const FaqList = () => {
  const message = useMessage();
  const [dataSource, setDataSource] = useState<IFaqItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [currentItem, setCurrentItem] = useState<IFaqItem | null>(null);
  const [form] = Form.useForm();
  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([]);

  // 加载 FAQ 列表
  const loadFaqItems = useCallback(async () => {
    setLoading(true);
    try {
      const response = await adminApi.get<{ items: IFaqItem[] }>('/admin/content/faq?limit=100');
      if (response.data.code === 0) {
        setDataSource((response.data.data as { items: IFaqItem[] })?.items || []);
      } else {
        message.error(response.data.message || '加载失败');
      }
    } catch (error: any) {
      console.error('加载 FAQ 失败:', error);
      message.error(error.response?.data?.message || '加载 FAQ 失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFaqItems();
  }, [loadFaqItems]);

  const handleEdit = (record: IFaqItem) => {
    setCurrentItem(record);
    form.setFieldsValue({
      question: record.questionZh,
      answer: record.answerZh,
      category: record.category,
      sortOrder: record.sortOrder,
      isActive: record.isActive,
    });
    setEditModalVisible(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);

      if (currentItem) {
        // 编辑模式
        const response = await adminApi.put(`/admin/content/faq/${currentItem.id}`, {
          question: values.question,
          answer: values.answer,
          category: values.category,
          sortOrder: values.sortOrder,
          isActive: values.isActive,
        });
        if (response.data.code === 0) {
          message.success('FAQ 已更新（自动翻译为多语言）');
          loadFaqItems();
        } else {
          message.error(response.data.message || '更新失败');
        }
      } else {
        // 新增模式
        const response = await adminApi.post('/admin/content/faq', {
          question: values.question,
          answer: values.answer,
          category: values.category,
          sortOrder: values.sortOrder,
        });
        if (response.data.code === 0) {
          message.success('FAQ 已创建（自动翻译为多语言）');
          loadFaqItems();
        } else {
          message.error(response.data.message || '创建失败');
        }
      }
      setEditModalVisible(false);
      form.resetFields();
      setCurrentItem(null);
    } catch (error: any) {
      console.error('保存失败:', error);
      message.error(error.response?.data?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (record: IFaqItem) => {
    try {
      const response = await adminApi.delete(`/admin/content/faq/${record.id}`);
      if (response.data.code === 0) {
        message.success('FAQ 已删除');
        loadFaqItems();
      } else {
        message.error(response.data.message || '删除失败');
      }
    } catch (error: any) {
      console.error('删除失败:', error);
      message.error(error.response?.data?.message || '删除失败');
    }
  };

  const handleToggleActive = async (record: IFaqItem) => {
    try {
      const response = await adminApi.put(`/admin/content/faq/${record.id}`, {
        isActive: !record.isActive,
      });
      if (response.data.code === 0) {
        message.success(record.isActive ? '已隐藏' : '已显示');
        loadFaqItems();
      } else {
        message.error(response.data.message || '更新失败');
      }
    } catch (error: any) {
      console.error('更新状态失败:', error);
      message.error(error.response?.data?.message || '更新失败');
    }
  };

  const handleRetranslate = async (record: IFaqItem) => {
    try {
      const response = await adminApi.post(`/admin/content/faq/${record.id}/retranslate`);
      if (response.data.code === 0) {
        message.success('已重新翻译');
        loadFaqItems();
      } else {
        message.error(response.data.message || '翻译失败');
      }
    } catch (error: any) {
      console.error('翻译失败:', error);
      message.error(error.response?.data?.message || '翻译失败');
    }
  };

  const handleAddNew = () => {
    setCurrentItem(null);
    form.resetFields();
    form.setFieldsValue({
      category: 'general',
      sortOrder: dataSource.length + 1,
      isActive: true,
    });
    setEditModalVisible(true);
  };

  const handleExpandAll = () => {
    setExpandedRowKeys(dataSource.map((item) => item.id));
  };

  const handleCollapseAll = () => {
    setExpandedRowKeys([]);
  };

  const getCategoryConfig = (category: string) => {
    return categoryOptions.find((opt) => opt.value === category) || categoryOptions[0];
  };

  const columns = [
    {
      title: '排序',
      dataIndex: 'sortOrder',
      key: 'sortOrder',
      width: 70,
      sorter: (a: IFaqItem, b: IFaqItem) => a.sortOrder - b.sortOrder,
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      width: 120,
      filters: categoryOptions.map((opt) => ({ text: opt.label, value: opt.value })),
      onFilter: (value: unknown, record: IFaqItem) => record.category === value,
      render: (category: string) => {
        const config = getCategoryConfig(category);
        return <Tag color={config.color}>{config.label}</Tag>;
      },
    },
    {
      title: '问题（中文）',
      dataIndex: 'questionZh',
      key: 'questionZh',
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 100,
      render: (isActive: boolean, record: IFaqItem) => (
        <Switch
          checked={isActive}
          onChange={() => handleToggleActive(record)}
          checkedChildren="显示"
          unCheckedChildren="隐藏"
        />
      ),
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 120,
      render: (date: string) => date?.split('T')[0] || '-',
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (_: unknown, record: IFaqItem) => (
        <Space>
          <Button
            size="small"
            type="primary"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Button
            size="small"
            icon={<TranslationOutlined />}
            onClick={() => handleRetranslate(record)}
            title="重新翻译"
          >
            翻译
          </Button>
          <Popconfirm
            title="确定要删除这条 FAQ 吗？"
            onConfirm={() => handleDelete(record)}
            okText="确定"
            cancelText="取消"
          >
            <Button size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <List>
      <Card
        title={
          <Space>
            <QuestionCircleOutlined />
            <span>FAQ 常见问题管理</span>
          </Space>
        }
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={loadFaqItems} loading={loading}>
              刷新
            </Button>
            <Button icon={<ExpandAltOutlined />} onClick={handleExpandAll}>
              展开全部
            </Button>
            <Button icon={<ShrinkOutlined />} onClick={handleCollapseAll}>
              收起全部
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAddNew}>
              新增 FAQ
            </Button>
          </Space>
        }
      >
        <Alert
          message="FAQ 内容支持自动翻译"
          description="创建或编辑 FAQ 时，只需填写中文内容，系统会自动翻译为多语言版本。如需重新翻译，点击「翻译」按钮。"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Spin spinning={loading}>
          <Table
            dataSource={dataSource}
            columns={columns}
            rowKey="id"
            pagination={{ pageSize: 10 }}
            expandable={{
              expandedRowKeys,
              onExpandedRowsChange: (keys) => setExpandedRowKeys(keys as string[]),
              expandedRowRender: (record) => (
                <div style={{ padding: '12px 24px' }}>
                  <Tabs size="small">
                    <Tabs.TabPane tab="中文" key="zh">
                      <div style={{ marginBottom: 8 }}>
                        <Text strong>问题：</Text>
                        <Text>{record.questionZh}</Text>
                      </div>
                      <div>
                        <Text strong>答案：</Text>
                        <div
                          style={{
                            marginTop: 4,
                            padding: 12,
                            background: '#1f1f1f',
                            borderRadius: 6,
                            color: '#9090A0',
                          }}
                        >
                          {record.answerZh}
                        </div>
                      </div>
                    </Tabs.TabPane>
                    <Tabs.TabPane tab="English" key="en">
                      <div style={{ marginBottom: 8 }}>
                        <Text strong>Question: </Text>
                        <Text>{record.questionEn || '(未翻译)'}</Text>
                      </div>
                      <div>
                        <Text strong>Answer: </Text>
                        <div
                          style={{
                            marginTop: 4,
                            padding: 12,
                            background: '#1f1f1f',
                            borderRadius: 6,
                            color: '#9090A0',
                          }}
                        >
                          {record.answerEn || '(未翻译)'}
                        </div>
                      </div>
                    </Tabs.TabPane>
                  </Tabs>
                </div>
              ),
            }}
          />
        </Spin>
      </Card>

      {/* 编辑弹窗 */}
      <Modal
        title={currentItem ? '编辑 FAQ' : '新增 FAQ'}
        open={editModalVisible}
        onOk={handleSave}
        onCancel={() => {
          setEditModalVisible(false);
          form.resetFields();
          setCurrentItem(null);
        }}
        width={800}
        okText="保存"
        cancelText="取消"
        confirmLoading={saving}
      >
        <Alert
          message="只需填写中文内容，系统自动翻译为多语言"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="category"
                label="分类"
                rules={[{ required: true, message: '请选择分类' }]}
              >
                <Select options={categoryOptions} placeholder="请选择分类" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="sortOrder" label="排序" rules={[{ required: true }]}>
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="isActive" label="状态" valuePropName="checked">
                <Switch checkedChildren="显示" unCheckedChildren="隐藏" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="question"
            label="问题（中文）"
            rules={[{ required: true, message: '请输入问题' }]}
          >
            <Input placeholder="请输入问题（自动翻译为多语言）" />
          </Form.Item>
          <Form.Item
            name="answer"
            label="答案（中文）"
            rules={[{ required: true, message: '请输入答案' }]}
          >
            <TextArea rows={6} placeholder="请输入答案（自动翻译为多语言）" />
          </Form.Item>
        </Form>
      </Modal>
    </List>
  );
};
