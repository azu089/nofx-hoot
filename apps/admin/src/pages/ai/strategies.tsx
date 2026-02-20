/**
 * AI 智能交易 - 策略监控页
 * 查看全平台用户的 AI 策略运行状态，支持紧急停止
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
  Descriptions,
  Form,
  message,
} from 'antd';
import {
  ReloadOutlined,
  StopOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { useState, useEffect, useCallback } from 'react';
import { adminApi } from '../../lib/admin-api';

const { Title, Text } = Typography;
const { Search } = Input;

interface AiStrategy {
  id: string;
  userId: string;
  username: string;
  name: string;
  tradingMode: string;
  strategyType: string;
  isActive: boolean;
  totalTrades: number;
  winRate: string;
  totalPnl: string;
  totalDebateCost: string;
  cycleCount: number;
  createdAt: string;
  updatedAt: string;
}

interface StrategyDetail {
  id: string;
  name: string;
  user: { nickname: string | null; email: string };
  riskControlConfig: any;
  indicatorConfig: any;
  coinSourceConfig: any;
  logs: any[];
  debateSessions: any[];
}

export const AiStrategiesPage = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AiStrategy[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<string>('');
  const [tradingMode, setTradingMode] = useState<string>('');

  const [detailVisible, setDetailVisible] = useState(false);
  const [detail, setDetail] = useState<StrategyDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [stopModalVisible, setStopModalVisible] = useState(false);
  const [stopTargetId, setStopTargetId] = useState('');
  const [stopForm] = Form.useForm();
  const [stopLoading, setStopLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
        ...(keyword ? { keyword } : {}),
        ...(status ? { status } : {}),
        ...(tradingMode ? { tradingMode } : {}),
      });
      const res = await adminApi.get<{ total: number; data: AiStrategy[] }>(`/admin/ai/strategies?${params}`);
      const responseData = res.data.data as { total: number; data: AiStrategy[] };
      setData(responseData?.data || []);
      setTotal(responseData?.total || 0);
    } catch (err: any) {
      message.error('加载失败：' + (err.message || '未知错误'));
    } finally {
      setLoading(false);
    }
  }, [page, keyword, status, tradingMode]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openDetail = async (id: string) => {
    setDetailVisible(true);
    setDetailLoading(true);
    try {
      const res = await adminApi.get<StrategyDetail>(`/admin/ai/strategies/${id}`);
      setDetail(res.data.data as StrategyDetail);
    } catch (err: any) {
      message.error('获取详情失败：' + (err.message || ''));
    } finally {
      setDetailLoading(false);
    }
  };

  const handleForceStop = async () => {
    try {
      await stopForm.validateFields();
      const values = stopForm.getFieldsValue();
      setStopLoading(true);
      await adminApi.post(`/admin/ai/strategies/${stopTargetId}/force-stop`, {
        reason: values.reason,
      });
      message.success('策略已强制停止');
      setStopModalVisible(false);
      stopForm.resetFields();
      loadData();
    } catch (err: any) {
      message.error('操作失败：' + (err.message || ''));
    } finally {
      setStopLoading(false);
    }
  };

  const columns = [
    {
      title: '用户',
      dataIndex: 'username',
      key: 'username',
      width: 120,
    },
    {
      title: '策略名称',
      dataIndex: 'name',
      key: 'name',
      width: 160,
    },
    {
      title: '模式',
      key: 'mode',
      width: 100,
      render: (r: AiStrategy) => (
        <Space>
          <Tag color={r.tradingMode === 'debate' ? 'purple' : 'blue'}>
            {r.tradingMode === 'debate' ? '辩论' : '单人'}
          </Tag>
          {r.strategyType === 'grid' && <Tag color="orange">网格</Tag>}
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 80,
      render: (v: boolean) => (
        <Tag color={v ? 'green' : 'default'}>{v ? '运行中' : '已停止'}</Tag>
      ),
    },
    {
      title: '总交易',
      dataIndex: 'totalTrades',
      key: 'totalTrades',
      width: 80,
    },
    {
      title: '胜率',
      dataIndex: 'winRate',
      key: 'winRate',
      width: 80,
      render: (v: string) => {
        const pct = parseFloat(v);
        return (
          <Text style={{ color: pct >= 50 ? '#52c41a' : '#f5222d' }}>
            {pct.toFixed(1)}%
          </Text>
        );
      },
    },
    {
      title: '总盈亏',
      dataIndex: 'totalPnl',
      key: 'totalPnl',
      width: 100,
      render: (v: string) => {
        const pnl = parseFloat(v);
        return (
          <Text style={{ color: pnl >= 0 ? '#52c41a' : '#f5222d' }}>
            {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}
          </Text>
        );
      },
    },
    {
      title: '辩论成本',
      dataIndex: 'totalDebateCost',
      key: 'totalDebateCost',
      width: 100,
      render: (v: string) => `$${parseFloat(v).toFixed(4)}`,
    },
    {
      title: '周期数',
      dataIndex: 'cycleCount',
      key: 'cycleCount',
      width: 80,
    },
    {
      title: '操作',
      key: 'action',
      width: 140,
      render: (r: AiStrategy) => (
        <Space>
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => openDetail(r.id)}
          >
            详情
          </Button>
          {r.isActive && (
            <Button
              size="small"
              danger
              icon={<StopOutlined />}
              onClick={() => {
                setStopTargetId(r.id);
                setStopModalVisible(true);
              }}
            >
              停止
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
          <Title level={3} style={{ margin: 0 }}>策略监控</Title>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            刷新
          </Button>
        </div>

        {/* 搜索过滤 */}
        <Card size="small">
          <Space wrap>
            <Search
              placeholder="策略名称搜索"
              allowClear
              style={{ width: 200 }}
              onSearch={(v) => { setKeyword(v); setPage(1); }}
            />
            <Select
              placeholder="运行状态"
              allowClear
              style={{ width: 120 }}
              onChange={(v) => { setStatus(v || ''); setPage(1); }}
              options={[
                { label: '运行中', value: 'active' },
                { label: '已停止', value: 'stopped' },
              ]}
            />
            <Select
              placeholder="交易模式"
              allowClear
              style={{ width: 120 }}
              onChange={(v) => { setTradingMode(v || ''); setPage(1); }}
              options={[
                { label: '单人模式', value: 'solo' },
                { label: '辩论模式', value: 'debate' },
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

      {/* 策略详情 Modal */}
      <Modal
        title="策略详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={800}
      >
        {detailLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>加载中...</div>
        ) : detail ? (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="用户">{detail.user?.nickname || detail.user?.email}</Descriptions.Item>
              <Descriptions.Item label="策略名">{detail.name}</Descriptions.Item>
            </Descriptions>
            <div>
              <Text strong>风控配置：</Text>
              <pre style={{ background: '#f5f5f5', padding: 8, borderRadius: 4, maxHeight: 200, overflow: 'auto' }}>
                {JSON.stringify(detail.riskControlConfig, null, 2)}
              </pre>
            </div>
            <div>
              <Text strong>最近10条决策日志：</Text>
              <Table
                size="small"
                dataSource={detail.logs || []}
                rowKey="id"
                pagination={false}
                columns={[
                  { title: '币种', dataIndex: 'symbol', width: 100 },
                  {
                    title: '决策',
                    dataIndex: 'decision',
                    render: (d: any) => (
                      <Tag color={d?.action?.includes('long') ? 'green' : d?.action?.includes('short') ? 'red' : 'default'}>
                        {d?.action || '-'}
                      </Tag>
                    ),
                  },
                  {
                    title: '置信度',
                    dataIndex: 'decision',
                    render: (d: any) => `${d?.confidence || 0}%`,
                  },
                  {
                    title: '已执行',
                    dataIndex: 'executed',
                    render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? '是' : '否'}</Tag>,
                  },
                  { title: '时间', dataIndex: 'createdAt', render: (v: string) => new Date(v).toLocaleString('zh-CN') },
                ]}
              />
            </div>
          </Space>
        ) : null}
      </Modal>

      {/* 紧急停止 Modal */}
      <Modal
        title="确认强制停止策略"
        open={stopModalVisible}
        onCancel={() => { setStopModalVisible(false); stopForm.resetFields(); }}
        onOk={handleForceStop}
        okText="确认停止"
        okButtonProps={{ danger: true, loading: stopLoading }}
      >
        <Form form={stopForm} layout="vertical">
          <Form.Item
            label="停止原因"
            name="reason"
            rules={[{ required: true, message: '请填写停止原因' }]}
          >
            <Input.TextArea rows={3} placeholder="请说明强制停止该策略的原因" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
