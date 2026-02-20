/**
 * AI 智能交易 - 用户配置管理页
 * 查看/停用用户 AI 配置，清空 LLM API Keys
 */
import {
  Card,
  Table,
  Tag,
  Space,
  Button,
  Input,
  Select,
  Typography,
  Modal,
  Form,
  Popconfirm,
  message,
} from 'antd';
import { ReloadOutlined, StopOutlined, KeyOutlined } from '@ant-design/icons';
import { useState, useEffect, useCallback } from 'react';
import { adminApi } from '../../lib/admin-api';

const { Title, Text } = Typography;
const { Search } = Input;

interface AiConfig {
  id: string;
  userId: string;
  username: string;
  isEnabled: boolean;
  autoEnabled: boolean;
  autoStatus: string;
  models: string[];
  monthlyBudget: string;
  currentSpend: string;
  maxLeverage: number;
  apiKeys: string[];
  updatedAt: string;
}

export const AiConfigsPage = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AiConfig[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [isEnabled, setIsEnabled] = useState<string>('');

  const [disableModalVisible, setDisableModalVisible] = useState(false);
  const [disableTargetId, setDisableTargetId] = useState('');
  const [disableForm] = Form.useForm();
  const [disableLoading, setDisableLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
        ...(keyword ? { keyword } : {}),
        ...(isEnabled !== '' ? { isEnabled } : {}),
      });
      const res = await adminApi.get<{ total: number; data: AiConfig[] }>(`/admin/ai/configs?${params}`);
      const responseData = res.data.data as { total: number; data: AiConfig[] };
      setData(responseData?.data || []);
      setTotal(responseData?.total || 0);
    } catch (err: any) {
      console.error('加载失败', err);
    } finally {
      setLoading(false);
    }
  }, [page, keyword, isEnabled]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleResetKeys = async (userId: string) => {
    try {
      await adminApi.post(`/admin/ai/configs/${userId}/reset-keys`, {});
      message.success('API Keys 已清空');
      loadData();
    } catch (err: any) {
      message.error('操作失败：' + (err.message || ''));
    }
  };

  const handleDisable = async () => {
    try {
      await disableForm.validateFields();
      const values = disableForm.getFieldsValue();
      setDisableLoading(true);
      await adminApi.post(`/admin/ai/configs/${disableTargetId}/disable`, {
        reason: values.reason,
      });
      message.success('已停用该用户 AI 功能');
      setDisableModalVisible(false);
      disableForm.resetFields();
      loadData();
    } catch (err: any) {
      message.error('操作失败：' + (err.message || ''));
    } finally {
      setDisableLoading(false);
    }
  };

  const columns = [
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      width: 130,
    },
    {
      title: 'AI 功能',
      dataIndex: 'isEnabled',
      key: 'isEnabled',
      width: 80,
      render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? '启用' : '停用'}</Tag>,
    },
    {
      title: '自动运行',
      dataIndex: 'autoEnabled',
      key: 'autoEnabled',
      width: 90,
      render: (v: boolean, r: AiConfig) => (
        <Space>
          <Tag color={v ? 'blue' : 'default'}>{v ? '开启' : '关闭'}</Tag>
          {v && <Tag color={r.autoStatus === 'running' ? 'processing' : 'default'}>{r.autoStatus}</Tag>}
        </Space>
      ),
    },
    {
      title: '月预算',
      dataIndex: 'monthlyBudget',
      key: 'monthlyBudget',
      width: 90,
      render: (v: string) => `$${parseFloat(v).toFixed(2)}`,
    },
    {
      title: '本月已花费',
      dataIndex: 'currentSpend',
      key: 'currentSpend',
      width: 110,
      render: (v: string, r: AiConfig) => {
        const spent = parseFloat(v);
        const budget = parseFloat(r.monthlyBudget);
        const pct = budget > 0 ? (spent / budget * 100).toFixed(0) : 0;
        return (
          <Text style={{ color: spent > budget * 0.8 ? '#f5222d' : undefined }}>
            ${spent.toFixed(4)} ({pct}%)
          </Text>
        );
      },
    },
    {
      title: '最大杠杆',
      dataIndex: 'maxLeverage',
      key: 'maxLeverage',
      width: 80,
      render: (v: number) => `${v}x`,
    },
    {
      title: 'API Keys',
      dataIndex: 'apiKeys',
      key: 'apiKeys',
      width: 130,
      render: (v: string[]) => (
        <Space size={2} wrap>
          {v.map((k, i) => <Tag key={i} color="processing">{k}</Tag>)}
          {v.length === 0 && <Text type="secondary">无</Text>}
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      render: (r: AiConfig) => (
        <Space>
          {r.apiKeys.length > 0 && (
            <Popconfirm
              title="确认清空该用户的 LLM API Keys？"
              onConfirm={() => handleResetKeys(r.userId)}
              okText="确认"
              cancelText="取消"
            >
              <Button size="small" icon={<KeyOutlined />} danger>
                清空Keys
              </Button>
            </Popconfirm>
          )}
          {r.isEnabled && (
            <Button
              size="small"
              danger
              icon={<StopOutlined />}
              onClick={() => {
                setDisableTargetId(r.userId);
                setDisableModalVisible(true);
              }}
            >
              停用
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title level={3} style={{ margin: 0 }}>用户 AI 配置</Title>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            刷新
          </Button>
        </div>

        <Card size="small">
          <Space wrap>
            <Search
              placeholder="搜索用户名/邮箱"
              allowClear
              style={{ width: 220 }}
              onSearch={(v) => { setKeyword(v); setPage(1); }}
            />
            <Select
              placeholder="AI 功能状态"
              allowClear
              style={{ width: 130 }}
              onChange={(v) => { setIsEnabled(v ?? ''); setPage(1); }}
              options={[
                { label: '已启用', value: 'true' },
                { label: '已停用', value: 'false' },
              ]}
            />
          </Space>
        </Card>

        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1000 }}
          pagination={{
            current: page,
            total,
            pageSize: 20,
            onChange: (p) => setPage(p),
            showTotal: (t) => `共 ${t} 条`,
          }}
        />
      </Space>

      {/* 停用确认 Modal */}
      <Modal
        title="停用用户 AI 功能"
        open={disableModalVisible}
        onCancel={() => { setDisableModalVisible(false); disableForm.resetFields(); }}
        onOk={handleDisable}
        okText="确认停用"
        okButtonProps={{ danger: true, loading: disableLoading }}
      >
        <p>停用后将同时停止该用户所有运行中的策略。</p>
        <Form form={disableForm} layout="vertical">
          <Form.Item
            label="停用原因"
            name="reason"
            rules={[{ required: true, message: '请填写停用原因' }]}
          >
            <Input.TextArea rows={3} placeholder="请说明停用原因" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
