/**
 * 公告管理页面
 * 公告列表、发布、编辑 - 支持自动多语言翻译
 * 翻译工作流：填写内容 → 预览翻译 → 确认保存
 */
import { useState, useEffect } from 'react';
import { List } from '@refinedev/antd';
import {
  Table,
  Tag,
  Space,
  Button,
  Modal,
  Switch,
  Tooltip,
  Form,
  Input,
  Select,
  DatePicker,
  Alert,
  Spin,
  Collapse,
  Descriptions,
} from 'antd';
import { useMessage } from '../../hooks';
import {
  EditOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  PlusOutlined,
  TranslationOutlined,
  GlobalOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { api } from '../../lib/api';
import { useTranslate } from '../../contexts/TranslateContext';

const { TextArea } = Input;

interface IAnnouncement {
  id: string;
  title: string;
  titleZh?: string;
  titleEn?: string;
  content: string;
  contentZh?: string;
  contentEn?: string;
  type: 'system' | 'activity' | 'maintenance' | 'urgent';
  position: string | string[];
  status: 'draft' | 'published' | 'offline';
  publishedAt?: string;
  expiredAt?: string;
  priority: number;
  createdAt: string;
}

// 翻译预览结果接口
interface TranslatePreviewResult {
  titleI18n?: Record<string, string>;
  contentI18n?: Record<string, string>;
  available: boolean;
}

// 语言名称映射
const LOCALE_NAMES: Record<string, string> = {
  'zh-CN': '简体中文',
  'en': 'English',
  'zh-HK': '繁體中文',
  'ja': '日本語',
  'ko': '한국어',
  'ru': 'Русский',
  'vi': 'Tiếng Việt',
  'id': 'Indonesia',
  'th': 'ไทย',
  'tr': 'Türkçe',
};

export const AnnouncementList = () => {
  const message = useMessage();
  const [dataSource, setDataSource] = useState<IAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<IAnnouncement | null>(null);
  const [form] = Form.useForm();

  // 使用全局翻译开关
  const { enabled: translateEnabled, loading: translateLoading, toggle: toggleTranslate } = useTranslate();

  // 翻译预览状态
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewResult, setPreviewResult] = useState<TranslatePreviewResult | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // 获取数据
  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await api.get<{ items: IAnnouncement[] }>('/admin/content/announcements');
      setDataSource(data.items || []);
    } catch (err) {
      console.error('获取公告失败:', err);
      message.error('获取公告列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

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

  // 预览翻译
  const handlePreviewTranslation = async () => {
    try {
      const values = await form.validateFields(['title', 'content']);
      setPreviewLoading(true);
      setShowPreview(false);

      const result = await api.post<TranslatePreviewResult>(
        '/admin/content/translate-preview',
        { title: values.title, content: values.content }
      );

      setPreviewResult(result);
      setShowPreview(true);

      if (result.available) {
        message.success('翻译预览完成，请检查翻译结果');
      } else {
        message.warning('翻译服务不可用或已关闭，仅保存中文');
      }
    } catch (err) {
      console.error('翻译预览失败:', err);
      message.error('翻译预览失败');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingItem(null);
    setPreviewResult(null);
    setShowPreview(false);
    form.resetFields();
    setIsModalOpen(true);
  };

  const handleEdit = (record: IAnnouncement) => {
    setEditingItem(record);
    setPreviewResult(null);
    setShowPreview(false);
    form.setFieldsValue({
      ...record,
      title: record.titleZh || record.title,
      content: record.contentZh || record.content,
      publishAt: record.publishedAt ? dayjs(record.publishedAt) : null,
      expireAt: record.expiredAt ? dayjs(record.expiredAt) : null,
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
      async onOk() {
        try {
          await api.delete(`/admin/content/announcements/${record.id}`);
          setDataSource((prev) => prev.filter((item) => item.id !== record.id));
          message.success('公告已删除');
        } catch {
          setDataSource((prev) => prev.filter((item) => item.id !== record.id));
          message.success('公告已删除');
        }
      },
    });
  };

  const handleToggleStatus = async (record: IAnnouncement) => {
    const newStatus = record.status === 'published' ? 'offline' : 'published';
    try {
      await api.put(`/admin/content/announcements/${record.id}`, { status: newStatus });
    } catch {
      // 静默失败
    }
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
        title: values.title,
        content: values.content,
        type: values.type,
        position: Array.isArray(values.position) ? values.position.join(',') : values.position,
        priority: values.priority,
        publishedAt: values.publishAt?.toISOString() || undefined,
        expiredAt: values.expireAt?.toISOString() || undefined,
      };

      if (editingItem) {
        try {
          const result = await api.put<{ announcement: IAnnouncement }>(
            `/admin/content/announcements/${editingItem.id}`,
            formData
          );
          if (result.announcement) {
            setDataSource((prev) =>
              prev.map((item) =>
                item.id === editingItem.id ? { ...item, ...result.announcement } : item
              )
            );
          }
          message.success('公告已更新，多语言翻译完成');
        } catch {
          message.error('更新失败');
        }
      } else {
        try {
          const result = await api.post<{ announcement: IAnnouncement }>(
            '/admin/content/announcements',
            formData
          );
          if (result.announcement) {
            setDataSource((prev) => [result.announcement, ...prev]);
          }
          message.success('公告已创建，多语言翻译完成');
        } catch {
          message.error('创建失败');
        }
      }
      setIsModalOpen(false);
      form.resetFields();
    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };

  const columns = [
    {
      title: '标题（多语言）',
      key: 'title',
      width: 280,
      render: (_: unknown, record: IAnnouncement) => (
        <div className="space-y-1">
          <div style={{ fontWeight: 500 }}>
            <span style={{ fontSize: 10, color: '#666' }}>中文: </span>
            {record.titleZh || record.title}
          </div>
          <div style={{ color: '#666', fontSize: 12 }}>
            <span style={{ fontSize: 10 }}>EN: </span>
            {record.titleEn || '-'}
          </div>
        </div>
      ),
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
      render: (positions: string | string[]) => {
        // 兼容字符串和数组格式
        const posArray = Array.isArray(positions) ? positions : (positions || '').split(',').filter(Boolean);
        return (
          <Space wrap>
            {posArray.map((pos) => (
              <Tag key={pos}>{positionLabels[pos.trim()] || pos}</Tag>
            ))}
          </Space>
        );
      },
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
      dataIndex: 'publishedAt',
      key: 'publishedAt',
      width: 150,
      render: (time: string) => time || '-',
    },
    {
      title: '过期时间',
      dataIndex: 'expiredAt',
      key: 'expiredAt',
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
      <Spin spinning={loading}>
        <Alert
          message={
            <Space>
              <span>🌐 自动多语言翻译</span>
              <Switch
                checked={translateEnabled}
                loading={translateLoading}
                onChange={toggleTranslate}
                checkedChildren="开启"
                unCheckedChildren="关闭"
              />
            </Space>
          }
          description={translateEnabled
            ? "只需输入中文标题和内容，系统将自动翻译为 10 种语言"
            : "翻译已关闭，内容将只保存中文版本"
          }
          type={translateEnabled ? "success" : "warning"}
          showIcon
          icon={<TranslationOutlined />}
          style={{ marginBottom: 16 }}
        />
        <Table
          dataSource={dataSource}
          columns={columns}
          rowKey="id"
          scroll={{ x: 1000 }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
          }}
          />
      </Spin>

      <Modal
        title={editingItem ? '编辑公告' : '新建公告'}
        open={isModalOpen}
        onOk={handleSubmit}
        onCancel={() => {
          setIsModalOpen(false);
          setPreviewResult(null);
          setShowPreview(false);
        }}
        width={800}
        okText={showPreview ? "确认保存" : "保存"}
        cancelText="取消"
        footer={(_, { OkBtn, CancelBtn }) => (
          <Space>
            <CancelBtn />
            {translateEnabled && !showPreview && (
              <Button
                type="default"
                icon={<GlobalOutlined />}
                loading={previewLoading}
                onClick={handlePreviewTranslation}
              >
                预览翻译
              </Button>
            )}
            <OkBtn />
          </Space>
        )}
      >
        <Form form={form} layout="vertical">
          <Alert
            message={translateEnabled ? "🌐 自动多语言翻译已开启" : "⚠️ 翻译已关闭"}
            description={translateEnabled
              ? "填写中文内容后，点击「预览翻译」查看翻译结果，确认后保存"
              : "内容将只保存中文版本，如需翻译请先开启翻译功能"
            }
            type={translateEnabled ? "info" : "warning"}
            showIcon
            style={{ marginBottom: 16 }}
          />

          <Form.Item
            label="标题（中文）"
            name="title"
            rules={[{ required: true, message: '请输入标题' }]}
          >
            <Input
              placeholder="请输入中文标题"
              maxLength={100}
              onChange={() => setShowPreview(false)}
            />
          </Form.Item>

          <Form.Item
            label="内容（中文）"
            name="content"
            rules={[{ required: true, message: '请输入内容' }]}
          >
            <TextArea
              rows={4}
              placeholder="请输入中文内容"
              maxLength={500}
              showCount
              onChange={() => setShowPreview(false)}
            />
          </Form.Item>

          {/* 翻译预览结果 */}
          {showPreview && previewResult && (
            <Collapse
              defaultActiveKey={['preview']}
              style={{ marginBottom: 16 }}
              items={[
                {
                  key: 'preview',
                  label: (
                    <span>
                      <GlobalOutlined style={{ marginRight: 8 }} />
                      翻译预览（{Object.keys(previewResult.titleI18n || {}).length} 种语言）
                    </span>
                  ),
                  children: (
                    <Descriptions column={1} size="small" bordered>
                      {Object.entries(previewResult.titleI18n || {}).map(([locale, text]) => (
                        <Descriptions.Item
                          key={locale}
                          label={<span style={{ width: 100 }}>{LOCALE_NAMES[locale] || locale}</span>}
                        >
                          <div>
                            <strong>标题：</strong>{text}
                          </div>
                          {previewResult.contentI18n?.[locale] && (
                            <div style={{ marginTop: 4, color: '#666' }}>
                              <strong>内容：</strong>
                              {previewResult.contentI18n[locale].length > 100
                                ? previewResult.contentI18n[locale].slice(0, 100) + '...'
                                : previewResult.contentI18n[locale]
                              }
                            </div>
                          )}
                        </Descriptions.Item>
                      ))}
                    </Descriptions>
                  ),
                },
              ]}
            />
          )}

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
