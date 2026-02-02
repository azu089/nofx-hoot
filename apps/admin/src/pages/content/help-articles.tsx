/**
 * 帮助文章管理页面
 * 管理帮助中心的文章内容
 */
import { useState } from 'react';
import { List } from '@refinedev/antd';
import {
  Table,
  Space,
  Button,
  Modal,
  Form,
  Input,
  Switch,
  Card,
  Typography,
  Tabs,
  InputNumber,
  Popconfirm,
  Row,
  Col,
} from 'antd';
import {
  EditOutlined,
  PlusOutlined,
  DeleteOutlined,
  EyeOutlined,
  BookOutlined,
  KeyOutlined,
  RiseOutlined,
  WalletOutlined,
  SafetyOutlined,
  DollarOutlined,
} from '@ant-design/icons';
import { useMessage } from '../../hooks';

const { Text, Title } = Typography;
const { TextArea } = Input;

interface IHelpArticle {
  id: string;
  slug: string;
  titleZh: string;
  titleEn: string;
  contentZh: string;
  contentEn: string;
  category: string;
  icon: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// 图标映射
const iconMap: Record<string, React.ReactNode> = {
  'getting-started': <BookOutlined />,
  'api-keys': <KeyOutlined />,
  'strategies': <RiseOutlined />,
  'deposits-withdrawals': <WalletOutlined />,
  'security': <SafetyOutlined />,
  'billing': <DollarOutlined />,
};

// 模拟数据
const mockArticles: IHelpArticle[] = [
  {
    id: '1',
    slug: 'getting-started',
    titleZh: '快速入门',
    titleEn: 'Getting Started',
    contentZh: '# 快速入门\n\n欢迎使用 Hoot 平台...',
    contentEn: '# Getting Started\n\nWelcome to Hoot platform...',
    category: 'help',
    icon: 'BookOpen',
    sortOrder: 1,
    isActive: true,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-30',
  },
  {
    id: '2',
    slug: 'api-keys',
    titleZh: 'API 密钥管理',
    titleEn: 'API Key Management',
    contentZh: '# API 密钥管理\n\nAPI Key 是您在交易所创建的密钥对...',
    contentEn: '# API Key Management\n\nAn API Key is a key pair created on your exchange...',
    category: 'help',
    icon: 'Key',
    sortOrder: 2,
    isActive: true,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-30',
  },
  {
    id: '3',
    slug: 'strategies',
    titleZh: '策略使用指南',
    titleEn: 'Strategy Guide',
    contentZh: '# 策略使用指南\n\nHoot 策略市场汇集了多种专业量化策略...',
    contentEn: '# Strategy Guide\n\nHoot Strategy Market features various professional quantitative strategies...',
    category: 'help',
    icon: 'TrendingUp',
    sortOrder: 3,
    isActive: true,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-30',
  },
  {
    id: '4',
    slug: 'deposits-withdrawals',
    titleZh: '充值与提现',
    titleEn: 'Deposits & Withdrawals',
    contentZh: '# 充值与提现\n\nHoot 支持 USDT 充值...',
    contentEn: '# Deposits & Withdrawals\n\nHoot supports USDT deposits...',
    category: 'help',
    icon: 'CreditCard',
    sortOrder: 4,
    isActive: true,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-30',
  },
  {
    id: '5',
    slug: 'security',
    titleZh: '安全设置',
    titleEn: 'Security Settings',
    contentZh: '# 安全设置\n\nHoot 采用多层安全机制保护您的账户...',
    contentEn: '# Security Settings\n\nHoot uses multiple security layers to protect your account...',
    category: 'help',
    icon: 'Shield',
    sortOrder: 5,
    isActive: true,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-30',
  },
  {
    id: '6',
    slug: 'billing',
    titleZh: '计费说明',
    titleEn: 'Billing Information',
    contentZh: '# 计费说明\n\nHoot 采用透明的收费模式...',
    contentEn: '# Billing Information\n\nHoot uses transparent pricing...',
    category: 'help',
    icon: 'Receipt',
    sortOrder: 6,
    isActive: true,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-30',
  },
];

export const HelpArticleList = () => {
  const message = useMessage();
  const [dataSource, setDataSource] = useState<IHelpArticle[]>(mockArticles);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [currentArticle, setCurrentArticle] = useState<IHelpArticle | null>(null);
  const [form] = Form.useForm();
  const [activeTab, setActiveTab] = useState<'zh' | 'en'>('zh');

  const handleEdit = (record: IHelpArticle) => {
    setCurrentArticle(record);
    form.setFieldsValue(record);
    setEditModalVisible(true);
  };

  const handlePreview = (record: IHelpArticle) => {
    setCurrentArticle(record);
    setPreviewModalVisible(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (currentArticle) {
        // 编辑模式
        setDataSource((prev) =>
          prev.map((item) =>
            item.id === currentArticle.id
              ? { ...item, ...values, updatedAt: new Date().toISOString().split('T')[0] }
              : item
          )
        );
        message.success('文章已更新');
      } else {
        // 新增模式
        const newArticle: IHelpArticle = {
          ...values,
          id: String(Date.now()),
          createdAt: new Date().toISOString().split('T')[0],
          updatedAt: new Date().toISOString().split('T')[0],
        };
        setDataSource((prev) => [...prev, newArticle]);
        message.success('文章已创建');
      }
      setEditModalVisible(false);
      form.resetFields();
      setCurrentArticle(null);
    } catch (error) {
      console.error('保存失败:', error);
    }
  };

  const handleDelete = (record: IHelpArticle) => {
    setDataSource((prev) => prev.filter((item) => item.id !== record.id));
    message.success('文章已删除');
  };

  const handleToggleActive = (record: IHelpArticle) => {
    setDataSource((prev) =>
      prev.map((item) =>
        item.id === record.id ? { ...item, isActive: !item.isActive } : item
      )
    );
    message.success(record.isActive ? '已下架' : '已上架');
  };

  const handleAddNew = () => {
    setCurrentArticle(null);
    form.resetFields();
    form.setFieldsValue({
      category: 'help',
      sortOrder: dataSource.length + 1,
      isActive: true,
    });
    setEditModalVisible(true);
  };

  const columns = [
    {
      title: '排序',
      dataIndex: 'sortOrder',
      key: 'sortOrder',
      width: 70,
      sorter: (a: IHelpArticle, b: IHelpArticle) => a.sortOrder - b.sortOrder,
    },
    {
      title: '图标',
      dataIndex: 'slug',
      key: 'icon',
      width: 70,
      render: (slug: string) => (
        <span style={{ fontSize: 20 }}>{iconMap[slug] || <BookOutlined />}</span>
      ),
    },
    {
      title: 'Slug',
      dataIndex: 'slug',
      key: 'slug',
      width: 180,
      render: (slug: string) => <Text code>{slug}</Text>,
    },
    {
      title: '中文标题',
      dataIndex: 'titleZh',
      key: 'titleZh',
    },
    {
      title: '英文标题',
      dataIndex: 'titleEn',
      key: 'titleEn',
    },
    {
      title: '状态',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 100,
      render: (isActive: boolean, record: IHelpArticle) => (
        <Switch
          checked={isActive}
          onChange={() => handleToggleActive(record)}
          checkedChildren="上架"
          unCheckedChildren="下架"
        />
      ),
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 120,
    },
    {
      title: '操作',
      key: 'actions',
      width: 180,
      render: (_: unknown, record: IHelpArticle) => (
        <Space>
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handlePreview(record)}
          >
            预览
          </Button>
          <Button
            size="small"
            type="primary"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这篇文章吗？"
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
        title="帮助文章管理"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAddNew}>
            新增文章
          </Button>
        }
      >
        <Table
          dataSource={dataSource}
          columns={columns}
          rowKey="id"
          pagination={false}
        />
      </Card>

      {/* 编辑弹窗 */}
      <Modal
        title={currentArticle ? '编辑帮助文章' : '新增帮助文章'}
        open={editModalVisible}
        onOk={handleSave}
        onCancel={() => {
          setEditModalVisible(false);
          form.resetFields();
          setCurrentArticle(null);
        }}
        width={1000}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="slug"
                label="Slug (URL 标识符)"
                rules={[
                  { required: true, message: '请输入 Slug' },
                  { pattern: /^[a-z0-9-]+$/, message: '只能包含小写字母、数字和连字符' },
                ]}
              >
                <Input placeholder="例如: getting-started" disabled={!!currentArticle} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="sortOrder" label="排序" rules={[{ required: true }]}>
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="isActive" label="状态" valuePropName="checked">
                <Switch checkedChildren="上架" unCheckedChildren="下架" />
              </Form.Item>
            </Col>
          </Row>

          <Tabs activeKey={activeTab} onChange={(key) => setActiveTab(key as 'zh' | 'en')}>
            <Tabs.TabPane tab="中文内容" key="zh">
              <Form.Item
                name="titleZh"
                label="中文标题"
                rules={[{ required: true, message: '请输入中文标题' }]}
              >
                <Input placeholder="请输入中文标题" />
              </Form.Item>
              <Form.Item
                name="contentZh"
                label="中文内容 (支持 Markdown)"
                rules={[{ required: true, message: '请输入中文内容' }]}
              >
                <TextArea rows={15} placeholder="请输入中文内容，支持 Markdown 格式" />
              </Form.Item>
            </Tabs.TabPane>
            <Tabs.TabPane tab="English Content" key="en">
              <Form.Item
                name="titleEn"
                label="English Title"
                rules={[{ required: true, message: 'Please enter English title' }]}
              >
                <Input placeholder="Please enter English title" />
              </Form.Item>
              <Form.Item
                name="contentEn"
                label="English Content (Markdown supported)"
                rules={[{ required: true, message: 'Please enter English content' }]}
              >
                <TextArea rows={15} placeholder="Please enter English content, Markdown supported" />
              </Form.Item>
            </Tabs.TabPane>
          </Tabs>
        </Form>
      </Modal>

      {/* 预览弹窗 */}
      <Modal
        title={`预览: ${currentArticle?.titleZh || ''}`}
        open={previewModalVisible}
        onCancel={() => {
          setPreviewModalVisible(false);
          setCurrentArticle(null);
        }}
        footer={null}
        width={800}
      >
        {currentArticle && (
          <Tabs>
            <Tabs.TabPane tab="中文" key="zh">
              <div style={{ padding: '16px', background: '#1f1f1f', borderRadius: 8 }}>
                <Title level={3} style={{ color: '#fff' }}>
                  {currentArticle.titleZh}
                </Title>
                <div
                  style={{
                    color: '#9090A0',
                    whiteSpace: 'pre-wrap',
                    lineHeight: 1.8,
                  }}
                >
                  {currentArticle.contentZh}
                </div>
              </div>
            </Tabs.TabPane>
            <Tabs.TabPane tab="English" key="en">
              <div style={{ padding: '16px', background: '#1f1f1f', borderRadius: 8 }}>
                <Title level={3} style={{ color: '#fff' }}>
                  {currentArticle.titleEn}
                </Title>
                <div
                  style={{
                    color: '#9090A0',
                    whiteSpace: 'pre-wrap',
                    lineHeight: 1.8,
                  }}
                >
                  {currentArticle.contentEn}
                </div>
              </div>
            </Tabs.TabPane>
          </Tabs>
        )}
      </Modal>
    </List>
  );
};
