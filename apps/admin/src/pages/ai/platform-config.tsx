/**
 * AI 智能交易 - 平台 LLM 配置管理页
 * 管理员可在此配置平台级 API Key、启用/禁用 provider、调整 Token 成本单价
 * 修改后立即生效（后端 5 分钟缓存刷新）
 */
import {
  Card,
  Table,
  Tag,
  Space,
  Button,
  Typography,
  Modal,
  Form,
  Input,
  InputNumber,
  Switch,
  Alert,
  message,
  Divider,
} from 'antd';
import {
  ReloadOutlined,
  EditOutlined,
  KeyOutlined,
  DollarOutlined,
} from '@ant-design/icons';
import { useState, useEffect, useCallback } from 'react';
import { adminApi } from '../../lib/admin-api';

const { Title, Text } = Typography;

// ======================== 类型定义 ========================

interface ProviderConfig {
  apiKey: string;
  enabled: boolean;
  displayName: string;
  modelName?: string;
}

interface ModelCost {
  input: number;
  output: number;
}

interface LlmPlatformConfig {
  providers: Record<string, ProviderConfig>;
  modelCosts: Record<string, ModelCost>;
}

// Provider 顺序（固定）
const PROVIDER_ORDER = ['deepseek', 'openai', 'openrouter', 'qwen', 'grok', 'kimi'];

// 模型 → Provider 映射
const MODEL_PROVIDER_MAP: Record<string, string> = {
  'deepseek-chat':             'deepseek',
  'gpt-4o-mini':               'openai',
  'claude-3-5-haiku-20241022': 'openrouter',
  'gemini-2.0-flash':          'openrouter',
  'qwen-plus':                 'qwen',
  'grok-3':                    'grok',
  'moonshot-v1-8k':            'kimi',
};

// ======================== 主页面 ========================

export const AiPlatformConfigPage = () => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<LlmPlatformConfig | null>(null);

  // Provider 编辑 Modal
  const [providerModalVisible, setProviderModalVisible] = useState(false);
  const [editingProvider, setEditingProvider] = useState<string>('');
  const [providerForm] = Form.useForm();

  // 模型成本编辑 Modal
  const [costModalVisible, setCostModalVisible] = useState(false);
  const [editingModel, setEditingModel] = useState<string>('');
  const [costForm] = Form.useForm();

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.get<LlmPlatformConfig>('/admin/config/llm_platform_config');
      const data = (res.data as any)?.data ?? res.data;
      setConfig(data);
    } catch (err: any) {
      message.error('加载失败：' + (err.message || ''));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // 保存整个配置
  const saveConfig = async (updated: LlmPlatformConfig) => {
    setSaving(true);
    try {
      await adminApi.put('/admin/config/llm_platform_config', { value: updated });
      message.success('保存成功（5 分钟内生效）');
      await loadConfig();
    } catch (err: any) {
      message.error('保存失败：' + (err.message || ''));
    } finally {
      setSaving(false);
    }
  };

  // ---- Provider 启用/禁用 ----
  const handleToggleProvider = async (providerName: string, enabled: boolean) => {
    if (!config) return;
    const updated: LlmPlatformConfig = {
      ...config,
      providers: {
        ...config.providers,
        [providerName]: { ...config.providers[providerName], enabled },
      },
    };
    await saveConfig(updated);
  };

  // ---- Provider API Key 编辑 ----
  const openProviderModal = (providerName: string) => {
    setEditingProvider(providerName);
    providerForm.setFieldsValue({
      apiKey: '', // 不预填脱敏值，用户需重新输入
      modelName: config?.providers[providerName]?.modelName || '',
    });
    setProviderModalVisible(true);
  };

  const handleSaveProviderKey = async () => {
    try {
      const values = await providerForm.validateFields();
      if (!config) return;
      const updated: LlmPlatformConfig = {
        ...config,
        providers: {
          ...config.providers,
          [editingProvider]: {
            ...config.providers[editingProvider],
            apiKey: values.apiKey,
            modelName: values.modelName || '',
          },
        },
      };
      await saveConfig(updated);
      setProviderModalVisible(false);
      providerForm.resetFields();
    } catch { /* 校验错误，不处理 */ }
  };

  // ---- 模型成本编辑 ----
  const openCostModal = (modelName: string) => {
    const cost = config?.modelCosts[modelName];
    setEditingModel(modelName);
    costForm.setFieldsValue({ input: cost?.input, output: cost?.output });
    setCostModalVisible(true);
  };

  const handleSaveCost = async () => {
    try {
      const values = await costForm.validateFields();
      if (!config) return;
      const updated: LlmPlatformConfig = {
        ...config,
        modelCosts: {
          ...config.modelCosts,
          [editingModel]: { input: values.input, output: values.output },
        },
      };
      await saveConfig(updated);
      setCostModalVisible(false);
      costForm.resetFields();
    } catch { /* 校验错误，不处理 */ }
  };

  // ======================== Provider 表格 ========================

  const providerRows = PROVIDER_ORDER
    .filter((name) => config?.providers[name])
    .map((name) => ({ name, ...config!.providers[name] }));

  const providerColumns = [
    {
      title: 'Provider',
      dataIndex: 'displayName',
      key: 'displayName',
      width: 200,
      render: (text: string, row: { name: string; displayName: string; apiKey: string; enabled: boolean; modelName?: string }) => (
        <Space>
          <Text strong>{text}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>({row.name})</Text>
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'apiKey',
      key: 'status',
      width: 110,
      render: (apiKey: string) => (
        <Tag color={apiKey ? 'success' : 'default'}>
          {apiKey ? '已配置' : '未配置'}
        </Tag>
      ),
    },
    {
      title: 'API Key（脱敏）',
      dataIndex: 'apiKey',
      key: 'apiKey',
      render: (apiKey: string) => (
        <Text type={apiKey ? 'secondary' : 'danger'} style={{ fontFamily: 'monospace' }}>
          {apiKey || '—— 未配置 ——'}
        </Text>
      ),
    },
    {
      title: '当前模型',
      dataIndex: 'modelName',
      key: 'modelName',
      width: 160,
      render: (modelName: string) => (
        <Text type="secondary" style={{ fontFamily: 'monospace', fontSize: 12 }}>
          {modelName || '（默认）'}
        </Text>
      ),
    },
    {
      title: '启用',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 80,
      render: (enabled: boolean, row: { name: string; enabled: boolean }) => (
        <Switch
          checked={enabled}
          size="small"
          loading={saving}
          onChange={(v) => handleToggleProvider(row.name, v)}
        />
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: unknown, row: { name: string }) => (
        <Button
          size="small"
          icon={<KeyOutlined />}
          onClick={() => openProviderModal(row.name)}
        >
          更新 Key
        </Button>
      ),
    },
  ];

  // ======================== 模型成本表格 ========================

  const modelRows = Object.entries(config?.modelCosts || {}).map(([model, cost]) => ({
    model,
    provider: MODEL_PROVIDER_MAP[model] || '—',
    input: cost.input,
    output: cost.output,
  }));

  const costColumns = [
    {
      title: '模型',
      dataIndex: 'model',
      key: 'model',
      render: (text: string) => <Text style={{ fontFamily: 'monospace' }}>{text}</Text>,
    },
    {
      title: 'Provider',
      dataIndex: 'provider',
      key: 'provider',
      width: 120,
      render: (text: string) => <Tag>{text}</Tag>,
    },
    {
      title: 'Input ($/M tokens)',
      dataIndex: 'input',
      key: 'input',
      width: 160,
      render: (v: number) => <Text>${v.toFixed(2)}</Text>,
    },
    {
      title: 'Output ($/M tokens)',
      dataIndex: 'output',
      key: 'output',
      width: 160,
      render: (v: number) => <Text>${v.toFixed(2)}</Text>,
    },
    {
      title: '操作',
      key: 'action',
      width: 90,
      render: (_: unknown, row: { model: string }) => (
        <Button
          size="small"
          icon={<EditOutlined />}
          onClick={() => openCostModal(row.model)}
        >
          编辑
        </Button>
      ),
    },
  ];

  // ======================== 渲染 ========================

  return (
    <div style={{ padding: '24px' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* 页头 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title level={3} style={{ margin: 0 }}>平台 LLM 配置</Title>
          <Button icon={<ReloadOutlined />} onClick={loadConfig} loading={loading}>
            刷新
          </Button>
        </div>

        <Alert
          type="info"
          showIcon
          message="说明"
          description="API Key 查看时自动脱敏，仅在输入时可见。修改后立即写入数据库，后端缓存将在 5 分钟内刷新。用户自备 Key 优先于平台配置，平台配置优先于环境变量。"
        />

        {/* Provider API Keys */}
        <Card
          title={<Space><KeyOutlined /><span>Provider API Keys</span></Space>}
          size="small"
        >
          <Table
            columns={providerColumns}
            dataSource={providerRows}
            rowKey="name"
            loading={loading}
            pagination={false}
            scroll={{ x: 700 }}
          />
        </Card>

        <Divider />

        {/* 模型 Token 成本 */}
        <Card
          title={<Space><DollarOutlined /><span>模型 Token 成本</span></Space>}
          size="small"
        >
          <Table
            columns={costColumns}
            dataSource={modelRows}
            rowKey="model"
            loading={loading}
            pagination={false}
            scroll={{ x: 700 }}
          />
        </Card>
      </Space>

      {/* Provider Key 编辑 Modal */}
      <Modal
        title={`更新 ${config?.providers[editingProvider]?.displayName || editingProvider} API Key`}
        open={providerModalVisible}
        onCancel={() => { setProviderModalVisible(false); providerForm.resetFields(); }}
        onOk={handleSaveProviderKey}
        okText="保存"
        confirmLoading={saving}
        destroyOnClose
      >
        <p style={{ color: '#999', marginBottom: 16 }}>
          请输入新的 API Key。留空表示清除现有 Key（将回退到环境变量配置）。
        </p>
        <Form form={providerForm} layout="vertical">
          <Form.Item
            label="API Key"
            name="apiKey"
          >
            <Input.Password
              placeholder={`输入 ${editingProvider} API Key`}
              autoComplete="off"
            />
          </Form.Item>
          <Form.Item
            label="模型名称覆盖（可选）"
            name="modelName"
            extra="留空则使用代码默认模型版本。填入后调用此 Provider 的所有请求均使用该模型名。"
          >
            <Input
              placeholder="例如: grok-3-fast（留空则使用默认）"
              allowClear
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 模型成本编辑 Modal */}
      <Modal
        title={`编辑模型成本：${editingModel}`}
        open={costModalVisible}
        onCancel={() => { setCostModalVisible(false); costForm.resetFields(); }}
        onOk={handleSaveCost}
        okText="保存"
        confirmLoading={saving}
        destroyOnClose
      >
        <Form form={costForm} layout="vertical">
          <Form.Item
            label="Input 成本 ($ / 百万 tokens)"
            name="input"
            rules={[{ required: true, message: '请输入 Input 成本' }]}
          >
            <InputNumber
              min={0}
              step={0.01}
              precision={4}
              style={{ width: '100%' }}
              addonAfter="$/M"
            />
          </Form.Item>
          <Form.Item
            label="Output 成本 ($ / 百万 tokens)"
            name="output"
            rules={[{ required: true, message: '请输入 Output 成本' }]}
          >
            <InputNumber
              min={0}
              step={0.01}
              precision={4}
              style={{ width: '100%' }}
              addonAfter="$/M"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
