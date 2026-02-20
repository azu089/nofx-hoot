/**
 * AI 智能交易 - 决策日志页（安全审计）
 * 查看全平台 AI 每次决策记录，支持 JSON 详情查看
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
} from 'antd';
import { ReloadOutlined, EyeOutlined } from '@ant-design/icons';
import { useState, useEffect, useCallback } from 'react';
import { adminApi } from '../../lib/admin-api';

const { Title, Text } = Typography;
const { Search } = Input;

interface DecisionLog {
  id: string;
  strategyId: string;
  strategyName: string;
  username: string;
  userId: string;
  symbol: string;
  action: string;
  confidence: number;
  executed: boolean;
  decision: any;
  executionResult: any;
  createdAt: string;
}

const ACTION_COLOR: Record<string, string> = {
  open_long: 'green',
  open_short: 'red',
  close_long: 'cyan',
  close_short: 'orange',
  wait: 'default',
};

export const AiLogsPage = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<DecisionLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [strategyId, setStrategyId] = useState('');
  const [userId, setUserId] = useState('');
  const [action, setAction] = useState('');
  const [executed, setExecuted] = useState('');

  const [detailVisible, setDetailVisible] = useState(false);
  const [detailLog, setDetailLog] = useState<DecisionLog | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
        ...(strategyId ? { strategyId } : {}),
        ...(userId ? { userId } : {}),
        ...(action ? { action } : {}),
        ...(executed !== '' ? { executed } : {}),
      });
      const res = await adminApi.get<{ total: number; data: DecisionLog[] }>(`/admin/ai/logs?${params}`);
      const responseData = res.data.data as { total: number; data: DecisionLog[] };
      setData(responseData?.data || []);
      setTotal(responseData?.total || 0);
    } catch (err: any) {
      console.error('加载失败', err);
    } finally {
      setLoading(false);
    }
  }, [page, strategyId, userId, action, executed]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const columns = [
    {
      title: '用户',
      dataIndex: 'username',
      key: 'username',
      width: 110,
    },
    {
      title: '策略名',
      dataIndex: 'strategyName',
      key: 'strategyName',
      width: 130,
      ellipsis: true,
    },
    {
      title: '币种',
      dataIndex: 'symbol',
      key: 'symbol',
      width: 100,
    },
    {
      title: '决策',
      dataIndex: 'action',
      key: 'action',
      width: 110,
      render: (v: string) => (
        <Tag color={ACTION_COLOR[v] || 'default'}>{v || '-'}</Tag>
      ),
    },
    {
      title: '置信度',
      dataIndex: 'confidence',
      key: 'confidence',
      width: 80,
      render: (v: number) => (
        <Text style={{ color: v >= 70 ? '#52c41a' : v >= 50 ? '#faad14' : '#f5222d' }}>
          {v}%
        </Text>
      ),
    },
    {
      title: '已执行',
      dataIndex: 'executed',
      key: 'executed',
      width: 80,
      render: (v: boolean) => (
        <Tag color={v ? 'green' : 'default'}>{v ? '是' : '否'}</Tag>
      ),
    },
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (v: string) => new Date(v).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action_btn',
      width: 80,
      render: (r: DecisionLog) => (
        <Button
          size="small"
          icon={<EyeOutlined />}
          onClick={() => {
            setDetailLog(r);
            setDetailVisible(true);
          }}
        >
          详情
        </Button>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title level={3} style={{ margin: 0 }}>决策日志（安全审计）</Title>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            刷新
          </Button>
        </div>

        <Card size="small">
          <Space wrap>
            <Search
              placeholder="按用户ID筛选"
              allowClear
              style={{ width: 200 }}
              onSearch={(v) => { setUserId(v); setPage(1); }}
            />
            <Input
              placeholder="策略ID"
              allowClear
              style={{ width: 160 }}
              onPressEnter={(e) => { setStrategyId((e.target as HTMLInputElement).value); setPage(1); }}
            />
            <Select
              placeholder="决策类型"
              allowClear
              style={{ width: 130 }}
              onChange={(v) => { setAction(v || ''); setPage(1); }}
              options={[
                { label: '开多', value: 'open_long' },
                { label: '开空', value: 'open_short' },
                { label: '平多', value: 'close_long' },
                { label: '平空', value: 'close_short' },
                { label: '等待', value: 'wait' },
              ]}
            />
            <Select
              placeholder="是否已执行"
              allowClear
              style={{ width: 120 }}
              onChange={(v) => { setExecuted(v ?? ''); setPage(1); }}
              options={[
                { label: '已执行', value: 'true' },
                { label: '未执行', value: 'false' },
              ]}
            />
          </Space>
        </Card>

        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          scroll={{ x: 900 }}
          pagination={{
            current: page,
            total,
            pageSize: 20,
            onChange: (p) => setPage(p),
            showTotal: (t) => `共 ${t} 条`,
          }}
        />
      </Space>

      {/* 决策详情 Modal */}
      <Modal
        title="AI 决策详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={700}
      >
        {detailLog && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <div>
              <Text strong>用户：</Text>{detailLog.username}
              {'  '}
              <Text strong>策略：</Text>{detailLog.strategyName}
              {'  '}
              <Text strong>币种：</Text>{detailLog.symbol}
            </div>
            <div>
              <Text strong>决策 JSON：</Text>
              <pre style={{ background: '#f5f5f5', padding: 12, borderRadius: 4, maxHeight: 300, overflow: 'auto', fontSize: 12 }}>
                {JSON.stringify(detailLog.decision, null, 2)}
              </pre>
            </div>
            {detailLog.executionResult && (
              <div>
                <Text strong>执行结果 JSON：</Text>
                <pre style={{ background: '#f5f5f5', padding: 12, borderRadius: 4, maxHeight: 200, overflow: 'auto', fontSize: 12 }}>
                  {JSON.stringify(detailLog.executionResult, null, 2)}
                </pre>
              </div>
            )}
            <div>
              <Text type="secondary">
                时间：{new Date(detailLog.createdAt).toLocaleString('zh-CN')}
              </Text>
            </div>
          </Space>
        )}
      </Modal>
    </div>
  );
};
