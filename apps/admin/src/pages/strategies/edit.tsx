/**
 * 策略编辑页面
 * 修改策略配置、参数设置
 * 已对接真实 API:
 * - GET /admin/strategies/:id
 * - PUT /admin/strategies/:id
 */
import { Edit } from '@refinedev/antd';
import {
  Card,
  Form,
  Input,
  Select,
  InputNumber,
  Button,
  Alert,
  Modal,
  Switch,
  Row,
  Col,
  Spin,
  Typography,
  Space,
} from 'antd';
import {
  SaveOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useMessage } from '../../hooks';

const { TextArea } = Input;
const { Text } = Typography;

interface StrategyDetail {
  id: string;
  name: string;
  description: string;
  freqtradeId: string;
  riskLevel: string;
  isActive: boolean;
  isFeatured: boolean;
  sortOrder: number;
  imageUrl: string | null;
  tags: string[];
  nameI18n: Record<string, string>;
  descriptionI18n: Record<string, string>;
  tagsI18n: Record<string, string[]>;
  return7d: string | null;
  return30d: string | null;
  return90d: string | null;
  maxDrawdown: string | null;
  winRate: string | null;
  totalTrades: number;
  subscribersCount: number;
  createdAt: string;
  updatedAt: string;
}

export const StrategyEdit = () => {
  const message = useMessage();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [strategy, setStrategy] = useState<StrategyDetail | null>(null);

  // 获取策略详情
  useEffect(() => {
    const fetchStrategy = async () => {
      if (!id) return;
      setLoading(true);
      setError(null);
      try {
        const data = await api.get<StrategyDetail>(`/admin/strategies/${id}`);
        setStrategy(data);
        form.setFieldsValue({
          name: data.name,
          description: data.description,
          riskLevel: data.riskLevel || 'medium',
          isActive: data.isActive,
          isFeatured: data.isFeatured,
          sortOrder: data.sortOrder || 0,
          imageUrl: data.imageUrl || '',
          tags: data.tags || [],
        });
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : '获取策略信息失败';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };
    fetchStrategy();
  }, [id, form]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();

      Modal.confirm({
        title: '确认保存策略配置',
        icon: <ExclamationCircleOutlined />,
        content: (
          <div>
            <p>确定要保存对策略的修改吗？</p>
            <Alert
              message="注意：策略配置的修改将在保存后立即生效"
              type="warning"
              showIcon
              style={{ marginTop: 8 }}
            />
          </div>
        ),
        okText: '确认保存',
        cancelText: '取消',
        onOk: async () => {
          setSaving(true);
          try {
            await api.put(`/admin/strategies/${id}`, {
              name: values.name,
              description: values.description,
              riskLevel: values.riskLevel,
              isActive: values.isActive,
              isFeatured: values.isFeatured,
              sortOrder: values.sortOrder,
              imageUrl: values.imageUrl || null,
              tags: values.tags || [],
            });
            message.success('策略配置已保存');
            // 刷新数据
            const data = await api.get<StrategyDetail>(`/admin/strategies/${id}`);
            setStrategy(data);
          } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : '保存失败';
            message.error(errorMessage);
          } finally {
            setSaving(false);
          }
        },
      });
    } catch (error) {
      console.error('验证失败:', error);
    }
  };

  if (loading) {
    return (
      <Edit saveButtonProps={{ style: { display: 'none' } }}>
        <div style={{ textAlign: 'center', padding: 50 }}>
          <Spin size="large" />
        </div>
      </Edit>
    );
  }

  if (error || !strategy) {
    return (
      <Edit saveButtonProps={{ style: { display: 'none' } }}>
        <Alert
          message="加载失败"
          description={error || '策略不存在'}
          type="error"
          action={<Button onClick={() => window.location.reload()}>重试</Button>}
        />
      </Edit>
    );
  }

  return (
    <Edit
      saveButtonProps={{ style: { display: 'none' } }}
      headerButtons={[
        <Button key="back" onClick={() => navigate(`/strategies/${id}`)}>
          返回详情
        </Button>,
        <Button
          key="save"
          type="primary"
          icon={<SaveOutlined />}
          loading={saving}
          onClick={handleSave}
        >
          保存配置
        </Button>,
      ]}
    >
      <Form form={form} layout="vertical">
        <Row gutter={24}>
          <Col span={12}>
            {/* 基本信息 */}
            <Card title="基本信息" style={{ marginBottom: 24 }}>
              <Form.Item label="策略ID">
                <Input value={strategy.id} disabled />
              </Form.Item>

              <Form.Item label="Freqtrade ID">
                <Input value={strategy.freqtradeId} disabled />
              </Form.Item>

              <Form.Item
                label="策略名称"
                name="name"
                rules={[{ required: true, message: '请输入策略名称' }]}
              >
                <Input placeholder="策略名称" />
              </Form.Item>

              <Form.Item
                label="风险等级"
                name="riskLevel"
                rules={[{ required: true, message: '请选择风险等级' }]}
              >
                <Select
                  options={[
                    { label: '低风险', value: 'low' },
                    { label: '中风险', value: 'medium' },
                    { label: '高风险', value: 'high' },
                  ]}
                />
              </Form.Item>

              <Form.Item
                label="策略描述"
                name="description"
                rules={[{ required: true, message: '请输入策略描述' }]}
              >
                <TextArea rows={4} placeholder="详细描述策略的运作方式和特点" />
              </Form.Item>

              <Form.Item
                label="策略图标 URL"
                name="imageUrl"
              >
                <Input placeholder="https://example.com/image.png" />
              </Form.Item>

              <Form.Item
                label="标签"
                name="tags"
                extra="输入后按回车添加标签"
              >
                <Select
                  mode="tags"
                  placeholder="添加标签"
                  options={[
                    { label: 'AI', value: 'AI' },
                    { label: '趋势', value: '趋势' },
                    { label: '网格', value: '网格' },
                    { label: '套利', value: '套利' },
                    { label: '量化', value: '量化' },
                  ]}
                />
              </Form.Item>
            </Card>
          </Col>

          <Col span={12}>
            {/* 展示设置 */}
            <Card title="展示设置" style={{ marginBottom: 24 }}>
              <Form.Item
                label="策略状态"
                name="isActive"
                valuePropName="checked"
                extra="关闭后策略将不会在前端展示"
              >
                <Switch checkedChildren="启用" unCheckedChildren="停用" />
              </Form.Item>

              <Form.Item
                label="首页推荐"
                name="isFeatured"
                valuePropName="checked"
                extra="开启后策略将在首页推荐位展示"
              >
                <Switch checkedChildren="推荐" unCheckedChildren="普通" />
              </Form.Item>

              <Form.Item
                label="排序权重"
                name="sortOrder"
                extra="数值越大排序越靠前"
              >
                <InputNumber min={0} max={9999} style={{ width: '100%' }} />
              </Form.Item>
            </Card>

            {/* 统计信息（只读） */}
            <Card title="统计信息">
              <Space direction="vertical" style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text type="secondary">订阅用户数</Text>
                  <Text strong>{strategy.subscribersCount || 0} 人</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text type="secondary">总交易次数</Text>
                  <Text strong>{strategy.totalTrades || 0} 次</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text type="secondary">7天收益率</Text>
                  <Text strong style={{ color: parseFloat(strategy.return7d || '0') >= 0 ? '#52c41a' : '#f5222d' }}>
                    {strategy.return7d ? `${parseFloat(strategy.return7d) >= 0 ? '+' : ''}${parseFloat(strategy.return7d).toFixed(2)}%` : '-'}
                  </Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text type="secondary">30天收益率</Text>
                  <Text strong style={{ color: parseFloat(strategy.return30d || '0') >= 0 ? '#52c41a' : '#f5222d' }}>
                    {strategy.return30d ? `${parseFloat(strategy.return30d) >= 0 ? '+' : ''}${parseFloat(strategy.return30d).toFixed(2)}%` : '-'}
                  </Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text type="secondary">最大回撤</Text>
                  <Text strong style={{ color: '#f5222d' }}>
                    {strategy.maxDrawdown ? `${parseFloat(strategy.maxDrawdown).toFixed(2)}%` : '-'}
                  </Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text type="secondary">胜率</Text>
                  <Text strong>
                    {strategy.winRate ? `${parseFloat(strategy.winRate).toFixed(1)}%` : '-'}
                  </Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text type="secondary">创建时间</Text>
                  <Text>{new Date(strategy.createdAt).toLocaleString('zh-CN')}</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text type="secondary">更新时间</Text>
                  <Text>{new Date(strategy.updatedAt).toLocaleString('zh-CN')}</Text>
                </div>
              </Space>
            </Card>
          </Col>
        </Row>
      </Form>
    </Edit>
  );
};
