/**
 * AI 智能交易 - 研究会话页
 * 查看全平台用户的 AI 研究会话记录
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

interface AiResearchSession {
  id: string;
  userId: string;
  username: string;
  symbol: string;
  depth: string;
  status: string;
  autoExecute: boolean;
  totalCost: string;
  errorMessage: string | null;
  cycleNumber: number;
  rootSessionId: string | null;
  campaignStatus: string | null;
  createdAt: string;
  updatedAt: string;
}

const STATUS_COLOR: Record<string, string> = {
  running: 'processing',
  completed: 'success',
  failed: 'error',
};

const DEPTH_LABEL: Record<string, string> = {
  quick: '快速',
  standard: '标准',
  deep: '深度',
};

export const AiResearchPage = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AiResearchSession[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState('');
  const [symbol, setSymbol] = useState('');

  const [detailVisible, setDetailVisible] = useState(false);
  const [detailData, setDetailData] = useState<any>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
        ...(keyword ? { userId: keyword } : {}),
        ...(status ? { status } : {}),
        ...(symbol ? { symbol } : {}),
      });
      const res = await adminApi.get<{ total: number; data: AiResearchSession[] }>(`/admin/ai/research?${params}`);
      const responseData = res.data.data as { total: number; data: AiResearchSession[] };
      setData(responseData?.data || []);
      setTotal(responseData?.total || 0);
    } catch (err: any) {
      console.error('加载失败', err);
    } finally {
      setLoading(false);
    }
  }, [page, keyword, status, symbol]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const columns = [
    {
      title: '用户',
      dataIndex: 'username',
      key: 'username',
      width: 120,
    },
    {
      title: '币种',
      dataIndex: 'symbol',
      key: 'symbol',
      width: 100,
    },
    {
      title: '研究深度',
      dataIndex: 'depth',
      key: 'depth',
      width: 90,
      render: (v: string) => <Tag>{DEPTH_LABEL[v] || v}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (v: string) => <Tag color={STATUS_COLOR[v] || 'default'}>{v}</Tag>,
    },
    {
      title: '自动执行',
      dataIndex: 'autoExecute',
      key: 'autoExecute',
      width: 80,
      render: (v: boolean) => <Tag color={v ? 'blue' : 'default'}>{v ? '是' : '否'}</Tag>,
    },
    {
      title: 'LLM 成本',
      dataIndex: 'totalCost',
      key: 'totalCost',
      width: 100,
      render: (v: string) => `$${parseFloat(v || '0').toFixed(6)}`,
    },
    {
      title: '循环模式',
      key: 'cycle',
      width: 90,
      render: (r: AiResearchSession) =>
        r.campaignStatus ? (
          <Tag color="purple">{r.campaignStatus}</Tag>
        ) : (
          <Tag color="default">单次</Tag>
        ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (v: string) => new Date(v).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (r: AiResearchSession) => (
        <Button
          size="small"
          icon={<EyeOutlined />}
          onClick={() => {
            setDetailData(r);
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
          <Title level={3} style={{ margin: 0 }}>研究会话</Title>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            刷新
          </Button>
        </div>

        <Card size="small">
          <Space wrap>
            <Search
              placeholder="按用户ID搜索"
              allowClear
              style={{ width: 200 }}
              onSearch={(v) => { setKeyword(v); setPage(1); }}
            />
            <Input
              placeholder="币种筛选（如 BTC/USDT）"
              allowClear
              style={{ width: 180 }}
              onPressEnter={(e) => { setSymbol((e.target as HTMLInputElement).value); setPage(1); }}
            />
            <Select
              placeholder="状态"
              allowClear
              style={{ width: 120 }}
              onChange={(v) => { setStatus(v || ''); setPage(1); }}
              options={[
                { label: '运行中', value: 'running' },
                { label: '已完成', value: 'completed' },
                { label: '失败', value: 'failed' },
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

      <Modal
        title="研究会话详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={600}
      >
        {detailData && (
          <div>
            <p><Text strong>用户：</Text>{detailData.username}</p>
            <p><Text strong>币种：</Text>{detailData.symbol}</p>
            <p><Text strong>状态：</Text><Tag color={STATUS_COLOR[detailData.status]}>{detailData.status}</Tag></p>
            <p><Text strong>LLM 成本：</Text>${parseFloat(detailData.totalCost || '0').toFixed(6)} USD</p>
            {detailData.errorMessage && (
              <p><Text strong type="danger">错误信息：</Text>{detailData.errorMessage}</p>
            )}
            <p><Text strong>创建时间：</Text>{new Date(detailData.createdAt).toLocaleString('zh-CN')}</p>
          </div>
        )}
      </Modal>
    </div>
  );
};
