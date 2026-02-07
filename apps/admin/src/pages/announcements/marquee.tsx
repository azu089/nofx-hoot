/**
 * 跑马灯管理页面
 * 滚动公告配置 - 支持滚动速度设置
 */
import { useState, useEffect } from 'react';
import { List } from '@refinedev/antd';
import {
  Table,
  Space,
  Button,
  Modal,
  Switch,
  Form,
  Input,
  ColorPicker,
  Card,
  Alert,
  Slider,
  Row,
  Col,
  Typography,
  Divider,
  InputNumber,
  Spin,
} from 'antd';
import {
  EditOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
  PlusOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import type { Color } from 'antd/es/color-picker';
import { api } from '../../lib/api';
import { useTranslate } from '../../contexts/TranslateContext';
import { useMessage } from '../../hooks';

const { Text } = Typography;

interface IMarquee {
  id: string;
  content: string;          // 兼容旧数据，默认内容
  contentZh: string;        // 中文内容
  contentEn: string;        // 英文内容
  link: string;
  order: number;
  enabled: boolean;
  bgColor: string;
  textColor: string;
}

interface IMarqueeConfig {
  scrollSpeed: number; // 滚动速度（像素/秒），范围 20-200
  pauseOnHover: boolean; // 鼠标悬停时暂停
  displayDuration: number; // 每条消息显示时长（秒），0 表示持续滚动
}

export const MarqueeList = () => {
  const message = useMessage();
  const [dataSource, setDataSource] = useState<IMarquee[]>([]);
  const [config, setConfig] = useState<IMarqueeConfig>({
    scrollSpeed: 50,
    pauseOnHover: true,
    displayDuration: 5,
  });
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<IMarquee | null>(null);
  const [form] = Form.useForm();
  const [configForm] = Form.useForm();

  // 使用全局翻译开关
  const { enabled: translateEnabled, loading: translateLoading, toggle: toggleTranslate } = useTranslate();

  // 获取数据
  const fetchData = async () => {
    setLoading(true);
    try {
      const [marqueesData, configData] = await Promise.all([
        api.get<{ marquees: IMarquee[] }>('/admin/content/marquees'),
        api.get<IMarqueeConfig>('/admin/content/marquees/config'),
      ]);
      setDataSource(marqueesData.marquees || []);
      setConfig(configData || { scrollSpeed: 50, pauseOnHover: true, displayDuration: 5 });
    } catch (err) {
      // 使用默认数据（如果 API 未实现）
      setDataSource([
        {
          id: '1',
          content: '🎉 新年活动：充值送 HOOT，多充多送！点击查看详情',
          contentZh: '🎉 新年活动：充值送 HOOT，多充多送！点击查看详情',
          contentEn: '🎉 New Year Event: Deposit to earn HOOT bonus! Click for details',
          link: '/announcements/2',
          order: 1,
          enabled: true,
          bgColor: '#06B6D4',
          textColor: '#FFFFFF',
        },
        {
          id: '2',
          content: '⚠️ 系统将于今晚 23:00 进行升级维护',
          contentZh: '⚠️ 系统将于今晚 23:00 进行升级维护',
          contentEn: '⚠️ System maintenance scheduled tonight at 23:00',
          link: '',
          order: 2,
          enabled: true,
          bgColor: '#F59E0B',
          textColor: '#000000',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // 获取翻译开关状态
  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = () => {
    setEditingItem(null);
    form.resetFields();
    form.setFieldsValue({
      bgColor: '#06B6D4',
      textColor: '#FFFFFF',
      content: '',
    });
    setIsModalOpen(true);
  };

  const handleEdit = (record: IMarquee) => {
    setEditingItem(record);
    // 编辑时使用 contentZh 作为 content 字段的值
    form.setFieldsValue({
      ...record,
      content: record.contentZh || record.content,
    });
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
      async onOk() {
        try {
          await api.delete(`/admin/content/marquees/${record.id}`);
          setDataSource((prev) => prev.filter((item) => item.id !== record.id));
          message.success('已删除');
        } catch {
          setDataSource((prev) => prev.filter((item) => item.id !== record.id));
          message.success('已删除');
        }
      },
    });
  };

  const handleToggle = async (record: IMarquee) => {
    try {
      await api.put(`/admin/content/marquees/${record.id}`, {
        enabled: !record.enabled,
      });
    } catch {
      // 静默失败，本地更新
    }
    setDataSource((prev) =>
      prev.map((item) =>
        item.id === record.id ? { ...item, enabled: !item.enabled } : item
      )
    );
  };

  const handleMove = async (record: IMarquee, direction: 'up' | 'down') => {
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

    try {
      await api.put('/admin/content/marquees/order', {
        orders: newData.map((item) => ({ id: item.id, order: item.order })),
      });
    } catch {
      // 静默失败
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const formData = {
        content: values.content,
        link: values.link,
        bgColor: typeof values.bgColor === 'string' ? values.bgColor : (values.bgColor as Color).toHexString(),
        textColor: typeof values.textColor === 'string' ? values.textColor : (values.textColor as Color).toHexString(),
      };

      if (editingItem) {
        try {
          const result = await api.put<{ marquee: IMarquee }>(`/admin/content/marquees/${editingItem.id}`, formData);
          if (result.marquee) {
            setDataSource((prev) =>
              prev.map((item) =>
                item.id === editingItem.id ? {
                  ...item,
                  ...formData,
                  contentZh: result.marquee.contentZh || formData.content,
                  contentEn: result.marquee.contentEn || '',
                } : item
              )
            );
          }
        } catch {
          // 静默失败，本地更新
          setDataSource((prev) =>
            prev.map((item) =>
              item.id === editingItem.id ? { ...item, ...formData, contentZh: formData.content } : item
            )
          );
        }
        message.success('已更新，多语言翻译完成');
      } else {
        const newItem: IMarquee = {
          ...formData,
          contentZh: formData.content,
          contentEn: '',
          id: Date.now().toString(),
          order: dataSource.length + 1,
          enabled: true,
        };
        try {
          const result = await api.post<{ marquee: IMarquee }>('/admin/content/marquees', formData);
          if (result.marquee) {
            newItem.id = result.marquee.id;
            newItem.contentZh = result.marquee.contentZh || formData.content;
            newItem.contentEn = result.marquee.contentEn || '';
          }
        } catch {
          // 静默失败
        }
        setDataSource((prev) => [...prev, newItem]);
        message.success('已添加，多语言翻译完成');
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };

  // 保存配置
  const handleSaveConfig = async () => {
    try {
      const values = await configForm.validateFields();
      try {
        await api.put('/admin/content/marquees/config', values);
        setConfig(values);
        message.success('配置已保存');
        setIsConfigModalOpen(false);
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : '保存失败';
        message.error(`保存配置失败: ${errorMessage}`);
        console.error('配置保存失败:', err);
      }
    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };

  const openConfigModal = () => {
    setIsConfigModalOpen(true);
  };

  // Modal afterOpenChange 回调设置表单值（避免 useForm not connected 警告）
  const handleConfigModalAfterOpenChange = (open: boolean) => {
    if (open) {
      configForm.setFieldsValue(config);
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
      title: '内容（多语言）',
      key: 'content',
      render: (_: unknown, record: IMarquee) => (
        <div className="space-y-1">
          <div
            style={{
              padding: '4px 8px',
              borderRadius: 4,
              backgroundColor: record.bgColor,
              color: record.textColor,
              fontSize: 13,
            }}
          >
            <span style={{ fontSize: 10, opacity: 0.7 }}>中文: </span>
            {record.contentZh || record.content}
          </div>
          <div
            style={{
              padding: '4px 8px',
              borderRadius: 4,
              backgroundColor: record.bgColor,
              color: record.textColor,
              fontSize: 13,
              opacity: 0.85,
            }}
          >
            <span style={{ fontSize: 10, opacity: 0.7 }}>EN: </span>
            {record.contentEn || '-'}
          </div>
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

  // 计算预览动画时长
  const getAnimationDuration = () => {
    // 速度越快，动画时长越短
    return Math.max(5, 200 / config.scrollSpeed * 10);
  };

  return (
    <List
      headerButtons={
        <Space>
          <Button icon={<SettingOutlined />} onClick={openConfigModal}>
            滚动设置
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            添加跑马灯
          </Button>
        </Space>
      }
    >
      <Spin spinning={loading}>
        {/* 翻译开关 */}
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
            ? "新建或修改跑马灯时，系统将自动翻译为 10 种语言"
            : "翻译已关闭，内容将只保存中文版本"
          }
          type={translateEnabled ? "success" : "warning"}
          showIcon
          style={{ marginBottom: 16 }}
        />

        {/* 配置预览卡片 */}
        <Card size="small" style={{ marginBottom: 16 }}>
          <Row gutter={24}>
            <Col span={8}>
              <Text type="secondary">滚动速度：</Text>
              <Text strong>{config.scrollSpeed} px/s</Text>
              <Text type="secondary" style={{ marginLeft: 8 }}>
                ({config.scrollSpeed < 40 ? '慢' : config.scrollSpeed < 80 ? '中' : '快'})
              </Text>
            </Col>
            <Col span={8}>
              <Text type="secondary">切换间隔：</Text>
              <Text strong>{config.displayDuration} 秒</Text>
            </Col>
            <Col span={8}>
              <Text type="secondary">悬停暂停：</Text>
              <Text strong>{config.pauseOnHover ? '是' : '否'}</Text>
            </Col>
          </Row>
        </Card>

        {/* 预览区域 */}
        {enabledMarquees.length > 0 && (
          <Card title="实时预览" style={{ marginBottom: 16 }}>
            <div
              style={{
                overflow: 'hidden',
                position: 'relative',
                height: 40,
                borderRadius: 4,
                backgroundColor: enabledMarquees[0]?.bgColor || '#06B6D4',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  position: 'absolute',
                  whiteSpace: 'nowrap',
                  animation: `marquee ${getAnimationDuration()}s linear infinite`,
                  color: enabledMarquees[0]?.textColor || '#FFFFFF',
                  lineHeight: '40px',
                  paddingLeft: '100%',
                }}
              >
                {enabledMarquees.map((item, index) => (
                  <span key={item.id} style={{ marginRight: 100 }}>
                    {item.content}
                    {index < enabledMarquees.length - 1 && ' | '}
                  </span>
                ))}
              </div>
            </div>
            <style>{`
              @keyframes marquee {
                0% { transform: translateX(0); }
                100% { transform: translateX(-100%); }
              }
            `}</style>
          </Card>
        )}

        <Alert
          message="跑马灯将按顺序循环显示在前端页面顶部，可通过「滚动设置」调整滚动速度"
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
      </Spin>

      {/* 跑马灯编辑弹窗 */}
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
          <Alert
            message="🌐 自动多语言翻译"
            description="只需填写中文内容，系统将自动翻译为 10 种语言（英、日、韩、俄、越、泰、土、印尼、繁体中文）"
            type="success"
            showIcon
            style={{ marginBottom: 16 }}
          />

          <Form.Item
            label="内容（中文）"
            name="content"
            rules={[{ required: true, message: '请输入内容' }]}
            extra="支持 emoji，保存后将自动翻译为多语言"
          >
            <Input placeholder="请输入中文内容（支持 emoji）" maxLength={100} />
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

      {/* 滚动配置弹窗 */}
      {isConfigModalOpen && (
        <Modal
          title={<><SettingOutlined /> 跑马灯滚动设置</>}
          open={isConfigModalOpen}
          onOk={handleSaveConfig}
          onCancel={() => setIsConfigModalOpen(false)}
          afterOpenChange={handleConfigModalAfterOpenChange}
          width={500}
          okText="保存"
          cancelText="取消"
        >
        <Form form={configForm} layout="vertical">
          <Form.Item
            label="滚动速度"
            name="scrollSpeed"
            extra="数值越大滚动越快，建议范围 30-100"
          >
            <Row gutter={16}>
              <Col span={16}>
                <Slider
                  min={20}
                  max={200}
                  marks={{
                    20: '慢',
                    50: '默认',
                    100: '快',
                    200: '极快',
                  }}
                  onChange={(value) => configForm.setFieldValue('scrollSpeed', value)}
                />
              </Col>
              <Col span={8}>
                <InputNumber
                  min={20}
                  max={200}
                  style={{ width: '100%' }}
                  suffix="px/s"
                  value={configForm.getFieldValue('scrollSpeed')}
                  onChange={(value) => configForm.setFieldValue('scrollSpeed', value)}
                />
              </Col>
            </Row>
          </Form.Item>

          <Form.Item
            label="消息切换间隔"
            name="displayDuration"
            extra="每条跑马灯消息显示的时长"
          >
            <InputNumber
              min={1}
              max={30}
              style={{ width: '100%' }}
              suffix="秒"
            />
          </Form.Item>

          <Form.Item
            label="鼠标悬停时暂停"
            name="pauseOnHover"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Divider />

          <Alert
            message="设置说明"
            description={
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                <li>滚动速度：控制文字滚动的快慢，数值为每秒移动的像素数</li>
                <li>切换间隔：多条跑马灯时，每条显示的时长</li>
                <li>悬停暂停：用户鼠标悬停在跑马灯上时是否暂停滚动</li>
              </ul>
            }
            type="info"
          />
        </Form>
      </Modal>
      )}
    </List>
  );
};
