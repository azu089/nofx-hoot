/**
 * 法律文档管理页面
 * 管理用户协议、隐私政策、风险提示等法律文档
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
  DatePicker,
  Popconfirm,
  Row,
  Col,
  Alert,
  Spin,
} from 'antd';
import {
  EditOutlined,
  PlusOutlined,
  DeleteOutlined,
  EyeOutlined,
  FileTextOutlined,
  SafetyOutlined,
  WarningOutlined,
  HistoryOutlined,
  ReloadOutlined,
  TranslationOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { adminApi } from '../../lib/admin-api';
import { useMessage } from '../../hooks';

const { Text } = Typography;
const { TextArea } = Input;

interface ILegalDocument {
  id: string;
  slug: string;
  titleZh: string;
  titleEn: string;
  contentZh: string;
  contentEn: string;
  contentPreview?: string;
  version: string;
  effectiveAt: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// 图标映射
const iconMap: Record<string, React.ReactNode> = {
  terms: <FileTextOutlined />,
  privacy: <SafetyOutlined />,
  risk: <WarningOutlined />,
};

// 标签颜色映射
const tagColorMap: Record<string, string> = {
  terms: 'blue',
  privacy: 'green',
  risk: 'orange',
};

// 文档类型名称映射
const docTypeMap: Record<string, { zh: string; en: string }> = {
  terms: { zh: '用户协议', en: 'Terms of Service' },
  privacy: { zh: '隐私政策', en: 'Privacy Policy' },
  risk: { zh: '风险提示', en: 'Risk Disclosure' },
};

export const LegalDocumentList = () => {
  const message = useMessage();
  const [dataSource, setDataSource] = useState<ILegalDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [currentDoc, setCurrentDoc] = useState<ILegalDocument | null>(null);
  const [form] = Form.useForm();
  const [activeTab, setActiveTab] = useState<'zh' | 'en'>('zh');

  // 加载法律文档列表
  const loadDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const response = await adminApi.get<{ items: ILegalDocument[] }>('/admin/content/legal?limit=50');
      if (response.data.code === 0) {
        setDataSource((response.data.data as { items: ILegalDocument[] })?.items || []);
      } else {
        message.error(response.data.message || '加载失败');
      }
    } catch (error: any) {
      console.error('加载法律文档失败:', error);
      message.error(error.response?.data?.message || '加载法律文档失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  // 获取单个文档详情（用于编辑和预览）
  const loadDocumentDetail = async (id: string): Promise<ILegalDocument | null> => {
    try {
      const response = await adminApi.get<{ document: ILegalDocument }>(`/admin/content/legal/${id}`);
      if (response.data.code === 0) {
        return (response.data.data as { document: ILegalDocument })?.document;
      }
      return null;
    } catch (error) {
      console.error('加载文档详情失败:', error);
      return null;
    }
  };

  const handleEdit = async (record: ILegalDocument) => {
    // 加载完整文档内容
    const fullDoc = await loadDocumentDetail(record.id);
    if (fullDoc) {
      setCurrentDoc(fullDoc);
      form.setFieldsValue({
        slug: fullDoc.slug,
        title: fullDoc.titleZh,
        content: fullDoc.contentZh,
        version: fullDoc.version,
        effectiveAt: dayjs(fullDoc.effectiveAt),
        isActive: fullDoc.isActive,
      });
      setEditModalVisible(true);
    } else {
      message.error('加载文档详情失败');
    }
  };

  const handlePreview = async (record: ILegalDocument) => {
    const fullDoc = await loadDocumentDetail(record.id);
    if (fullDoc) {
      setCurrentDoc(fullDoc);
      setPreviewModalVisible(true);
    } else {
      message.error('加载文档详情失败');
    }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);

      const formattedValues = {
        title: values.title,
        content: values.content,
        version: values.version,
        effectiveAt: values.effectiveAt.toISOString(),
        isActive: values.isActive,
      };

      if (currentDoc) {
        // 编辑模式
        const response = await adminApi.put(`/admin/content/legal/${currentDoc.id}`, formattedValues);
        if (response.data.code === 0) {
          message.success('法律文档已更新（自动翻译为多语言）');
          loadDocuments();
        } else {
          message.error(response.data.message || '更新失败');
        }
      } else {
        // 新增模式
        const response = await adminApi.post('/admin/content/legal', {
          ...formattedValues,
          slug: values.slug,
        });
        if (response.data.code === 0) {
          message.success('法律文档已创建（自动翻译为多语言）');
          loadDocuments();
        } else {
          message.error(response.data.message || '创建失败');
        }
      }
      setEditModalVisible(false);
      form.resetFields();
      setCurrentDoc(null);
    } catch (error: any) {
      console.error('保存失败:', error);
      message.error(error.response?.data?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (record: ILegalDocument) => {
    try {
      const response = await adminApi.delete(`/admin/content/legal/${record.id}`);
      if (response.data.code === 0) {
        message.success('文档已删除');
        loadDocuments();
      } else {
        message.error(response.data.message || '删除失败');
      }
    } catch (error: any) {
      console.error('删除失败:', error);
      message.error(error.response?.data?.message || '删除失败');
    }
  };

  const handleToggleActive = async (record: ILegalDocument) => {
    try {
      const response = await adminApi.put(`/admin/content/legal/${record.id}`, {
        isActive: !record.isActive,
      });
      if (response.data.code === 0) {
        message.success(record.isActive ? '已下架' : '已上架');
        loadDocuments();
      } else {
        message.error(response.data.message || '更新失败');
      }
    } catch (error: any) {
      console.error('更新状态失败:', error);
      message.error(error.response?.data?.message || '更新失败');
    }
  };

  const handleRetranslate = async (record: ILegalDocument) => {
    try {
      const response = await adminApi.post(`/admin/content/legal/${record.id}/retranslate`);
      if (response.data.code === 0) {
        message.success('已重新翻译');
        loadDocuments();
      } else {
        message.error(response.data.message || '翻译失败');
      }
    } catch (error: any) {
      console.error('翻译失败:', error);
      message.error(error.response?.data?.message || '翻译失败');
    }
  };

  const handleAddNew = () => {
    setCurrentDoc(null);
    form.resetFields();
    form.setFieldsValue({
      version: '1.0',
      effectiveAt: dayjs(),
      isActive: true,
    });
    setEditModalVisible(true);
  };

  const handleVersionBump = async (record: ILegalDocument) => {
    const currentVersion = parseFloat(record.version);
    const newVersion = (currentVersion + 0.1).toFixed(1);

    try {
      const response = await adminApi.put(`/admin/content/legal/${record.id}`, {
        version: newVersion,
      });
      if (response.data.code === 0) {
        message.success(`版本已更新为 v${newVersion}`);
        loadDocuments();
      } else {
        message.error(response.data.message || '更新失败');
      }
    } catch (error: any) {
      console.error('版本更新失败:', error);
      message.error(error.response?.data?.message || '版本更新失败');
    }
  };

  const columns = [
    {
      title: '类型',
      dataIndex: 'slug',
      key: 'slug',
      width: 150,
      render: (slug: string) => (
        <Space>
          <span style={{ fontSize: 18 }}>{iconMap[slug] || <FileTextOutlined />}</span>
          <Tag color={tagColorMap[slug] || 'default'}>{docTypeMap[slug]?.zh || slug}</Tag>
        </Space>
      ),
    },
    {
      title: '中文标题',
      dataIndex: 'titleZh',
      key: 'titleZh',
    },
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      width: 100,
      render: (version: string) => <Text code>v{version}</Text>,
    },
    {
      title: '生效日期',
      dataIndex: 'effectiveAt',
      key: 'effectiveAt',
      width: 120,
      render: (date: string) => date?.split('T')[0] || '-',
    },
    {
      title: '状态',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 100,
      render: (isActive: boolean, record: ILegalDocument) => (
        <Switch
          checked={isActive}
          onChange={() => handleToggleActive(record)}
          checkedChildren="生效"
          unCheckedChildren="停用"
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
      width: 320,
      render: (_: unknown, record: ILegalDocument) => (
        <Space wrap>
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
          <Button
            size="small"
            icon={<TranslationOutlined />}
            onClick={() => handleRetranslate(record)}
            title="重新翻译"
          >
            翻译
          </Button>
          <Button
            size="small"
            icon={<HistoryOutlined />}
            onClick={() => handleVersionBump(record)}
          >
            升版本
          </Button>
          <Popconfirm
            title="确定要删除这份法律文档吗？"
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
        title="法律文档管理"
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={loadDocuments} loading={loading}>
              刷新
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAddNew}>
              新增文档
            </Button>
          </Space>
        }
      >
        <Alert
          message="法律文档管理说明"
          description="法律文档的修改需要谨慎操作。只需填写中文内容，系统自动翻译为多语言。建议每次修改后升级版本号，并更新生效日期。"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Spin spinning={loading}>
          <Table
            dataSource={dataSource}
            columns={columns}
            rowKey="id"
            pagination={false}
          />
        </Spin>
      </Card>

      {/* 编辑弹窗 */}
      <Modal
        title={currentDoc ? '编辑法律文档' : '新增法律文档'}
        open={editModalVisible}
        onOk={handleSave}
        onCancel={() => {
          setEditModalVisible(false);
          form.resetFields();
          setCurrentDoc(null);
        }}
        width={1000}
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
                name="slug"
                label="文档类型 (Slug)"
                rules={[
                  { required: true, message: '请输入 Slug' },
                  { pattern: /^[a-z-]+$/, message: '只能包含小写字母和连字符' },
                ]}
              >
                <Input
                  placeholder="例如: terms, privacy, risk"
                  disabled={!!currentDoc}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="version"
                label="版本号"
                rules={[{ required: true, message: '请输入版本号' }]}
              >
                <Input placeholder="例如: 1.0" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="effectiveAt"
                label="生效日期"
                rules={[{ required: true, message: '请选择生效日期' }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={20}>
              <Form.Item name="isActive" label="状态" valuePropName="checked">
                <Switch checkedChildren="生效中" unCheckedChildren="已停用" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="title"
            label="中文标题"
            rules={[{ required: true, message: '请输入中文标题' }]}
          >
            <Input placeholder="请输入中文标题（自动翻译为多语言）" />
          </Form.Item>
          <Form.Item
            name="content"
            label="中文内容 (支持 Markdown)"
            rules={[{ required: true, message: '请输入中文内容' }]}
          >
            <TextArea rows={20} placeholder="请输入中文内容，支持 Markdown 格式（自动翻译为多语言）" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 预览弹窗 */}
      <Modal
        title={
          <Space>
            {currentDoc && (iconMap[currentDoc.slug] || <FileTextOutlined />)}
            <span>{currentDoc?.titleZh || ''}</span>
            <Tag color="blue">v{currentDoc?.version}</Tag>
          </Space>
        }
        open={previewModalVisible}
        onCancel={() => {
          setPreviewModalVisible(false);
          setCurrentDoc(null);
        }}
        footer={null}
        width={900}
      >
        {currentDoc && (
          <Tabs activeKey={activeTab} onChange={(key) => setActiveTab(key as 'zh' | 'en')}>
            <Tabs.TabPane tab="中文" key="zh">
              <div
                style={{
                  padding: '24px',
                  background: '#1f1f1f',
                  borderRadius: 8,
                  maxHeight: '60vh',
                  overflow: 'auto',
                }}
              >
                <div
                  style={{
                    color: '#9090A0',
                    whiteSpace: 'pre-wrap',
                    lineHeight: 1.8,
                    fontSize: 14,
                  }}
                >
                  {currentDoc.contentZh}
                </div>
              </div>
            </Tabs.TabPane>
            <Tabs.TabPane tab="English" key="en">
              <div
                style={{
                  padding: '24px',
                  background: '#1f1f1f',
                  borderRadius: 8,
                  maxHeight: '60vh',
                  overflow: 'auto',
                }}
              >
                <div
                  style={{
                    color: '#9090A0',
                    whiteSpace: 'pre-wrap',
                    lineHeight: 1.8,
                    fontSize: 14,
                  }}
                >
                  {currentDoc.contentEn || '(未翻译)'}
                </div>
              </div>
            </Tabs.TabPane>
          </Tabs>
        )}
      </Modal>
    </List>
  );
};
