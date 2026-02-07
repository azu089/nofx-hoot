/**
 * 权重明细页面
 * 连接真实后端 API
 */
import { useState, useEffect, useCallback } from 'react';
import { List } from '@refinedev/antd';
import {
  Table,
  Tag,
  Space,
  Card,
  Row,
  Col,
  Statistic,
  Progress,
  Input,
  Select,
  Button,
  Typography,
  Tooltip,
  Spin,
} from 'antd';
import { useMessage } from '../../hooks';
import {
  SearchOutlined,
  InfoCircleOutlined,
  RiseOutlined,
  FallOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { adminApi } from '../../lib/admin-api';

const { Text } = Typography;

interface IWeightRecord {
  id: string;
  userId: string;
  username: string;
  type: string;
  amount: string;
  weight: string;
  totalDividends: string;
  lockDays: number;
  status: string;
  createdAt: string;
  unlocksAt: string | null;
}

interface IStats {
  totalStaked: string;
  totalStakers: number;
  weightedStaking: string;
  flexibleAmount: string;   // 活期（lockDays=0）
  lockedAmount: string;     // 定期（lockDays>0）
}

export const WeightsPage = () => {
  const message = useMessage();
  const [dataSource, setDataSource] = useState<IWeightRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<IStats | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [searchKeyword, setSearchKeyword] = useState('');

  // 加载质押记录
  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
      });
      if (statusFilter) params.append('status', statusFilter);

      const response = await adminApi.get(`/admin/ecosystem/staking/records?${params}`);
      if (response.data.code === 0) {
        const data = response.data.data as { items: any[]; total: number };
        // 映射数据
        const items: IWeightRecord[] = (data.items || []).map((r: any) => ({
          id: r.id,
          userId: r.userId,
          username: r.user?.nickname || r.user?.email || '-',
          type: r.type,
          amount: r.amount,
          weight: r.weight,
          totalDividends: r.totalDividends,
          lockDays: r.lockDays || 0,
          status: r.status,
          createdAt: r.createdAt,
          unlocksAt: r.unlocksAt,
        }));
        setDataSource(items);
        setTotal(data.total || 0);
      } else {
        message.error(response.data.message || '加载失败');
      }
    } catch (error: any) {
      console.error('加载质押记录失败:', error);
      message.error(error.response?.data?.message || '加载质押记录失败');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, statusFilter]);

  // 加载统计数据
  const loadStats = useCallback(async () => {
    try {
      const response = await adminApi.get('/admin/ecosystem/stats');
      if (response.data.code === 0) {
        setStats(response.data.data as IStats);
      }
    } catch (error) {
      console.error('加载统计数据失败:', error);
    }
  }, []);

  useEffect(() => {
    loadRecords();
    loadStats();
  }, [loadRecords, loadStats]);

  // 计算总权重和权重占比
  const totalWeight = dataSource.reduce((sum, r) => {
    const weightedAmount = parseFloat(r.amount || '0') * parseFloat(r.weight || '1');
    return sum + weightedAmount;
  }, 0);

  const statusColors: Record<string, string> = {
    active: 'green',
    unlocked: 'default',
    pending: 'orange',
    unstaking: 'orange',
  };

  const statusLabels: Record<string, string> = {
    active: '生效中',
    unlocked: '已释放',
    pending: '待生效',
    unstaking: '解锁中',
  };

  const handleSearch = () => {
    setPage(1);
    loadRecords();
  };

  const columns = [
    {
      title: '用户',
      key: 'user',
      width: 160,
      render: (_: unknown, record: IWeightRecord) => (
        <div>
          <div style={{ fontWeight: 500 }}>{record.username}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.userId?.slice(0, 8)}...</Text>
        </div>
      ),
    },
    {
      title: '锁定期',
      dataIndex: 'lockDays',
      key: 'lockDays',
      width: 100,
      render: (days: number) => (
        days === 0
          ? <Tag color="green">活期</Tag>
          : <Tag color="blue">{days} 天</Tag>
      ),
    },
    {
      title: '质押数量',
      dataIndex: 'amount',
      key: 'amount',
      width: 140,
      render: (amount: string) => (
        <span style={{ fontWeight: 500, color: '#1890ff' }}>
          {parseFloat(amount || '0').toLocaleString()} HOOT
        </span>
      ),
      sorter: (a: IWeightRecord, b: IWeightRecord) => parseFloat(a.amount) - parseFloat(b.amount),
    },
    {
      title: (
        <Space>
          权重乘数
          <Tooltip title="无锁定期固定1.0x，有锁定期随时间增加（最高3.0x）">
            <InfoCircleOutlined style={{ color: '#999' }} />
          </Tooltip>
        </Space>
      ),
      dataIndex: 'weight',
      key: 'weight',
      width: 100,
      render: (weight: string) => {
        const w = parseFloat(weight || '1');
        return (
          <Tag color={w >= 2 ? 'gold' : w > 1 ? 'green' : 'default'}>
            {w.toFixed(2)}x
          </Tag>
        );
      },
    },
    {
      title: '加权权重',
      key: 'weightedAmount',
      width: 140,
      render: (_: unknown, record: IWeightRecord) => {
        const weighted = parseFloat(record.amount || '0') * parseFloat(record.weight || '1');
        return (
          <span style={{ fontWeight: 600, color: '#52c41a' }}>
            {weighted.toLocaleString()}
          </span>
        );
      },
    },
    {
      title: '权重占比',
      key: 'weightShare',
      width: 140,
      render: (_: unknown, record: IWeightRecord) => {
        const weighted = parseFloat(record.amount || '0') * parseFloat(record.weight || '1');
        const share = totalWeight > 0
          ? ((weighted / totalWeight) * 100).toFixed(2)
          : '0.00';
        return (
          <Space>
            <Progress
              percent={parseFloat(share)}
              size="small"
              style={{ width: 60 }}
              showInfo={false}
              strokeColor="#722ed1"
            />
            <span>{share}%</span>
          </Space>
        );
      },
    },
    {
      title: '锁定天数',
      dataIndex: 'lockDays',
      key: 'lockDays',
      width: 100,
      render: (days: number) => (
        days === 0 ? <Text type="secondary">无锁定</Text> : `${days} 天`
      ),
    },
    {
      title: '累计分红',
      dataIndex: 'totalDividends',
      key: 'totalDividends',
      width: 120,
      render: (amount: string) => (
        <span style={{ color: '#52c41a' }}>
          {parseFloat(amount || '0').toFixed(2)} HOOT
        </span>
      ),
    },
    {
      title: '质押时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
      render: (date: string) => date ? new Date(date).toLocaleDateString() : '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={statusColors[status] || 'default'}>
          {statusLabels[status] || status}
        </Tag>
      ),
    },
  ];

  // 统计计算
  const totalStaked = parseFloat(stats?.totalStaked || '0');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawStats = stats as any;
  const flexibleAmount = parseFloat(rawStats?.flexibleAmount || rawStats?.typeAAmount || '0');
  const lockedAmount = parseFloat(rawStats?.lockedAmount || rawStats?.typeBAmount || '0');
  const flexibleShare = totalStaked > 0 ? ((flexibleAmount / totalStaked) * 100).toFixed(1) : '0';
  const lockedShare = totalStaked > 0 ? ((lockedAmount / totalStaked) * 100).toFixed(1) : '0';

  return (
    <List>
      <Spin spinning={loading}>
        {/* 统计卡片 */}
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={5}>
            <Card>
              <Statistic
                title="加权总权重"
                value={parseFloat(stats?.weightedStaking || '0')}
                valueStyle={{ color: '#722ed1' }}
                formatter={(value) => `${(Number(value) / 10000).toFixed(2)}万`}
              />
            </Card>
          </Col>
          <Col span={5}>
            <Card>
              <Statistic
                title="质押总量"
                value={totalStaked}
                valueStyle={{ color: '#1890ff' }}
                formatter={(value) => `${(Number(value) / 10000).toFixed(2)}万`}
                suffix="HOOT"
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic
                title="质押用户数"
                value={stats?.totalStakers || 0}
                valueStyle={{ color: '#52c41a' }}
                suffix="人"
              />
            </Card>
          </Col>
          <Col span={5}>
            <Card>
              <Statistic
                title="活期占比"
                value={flexibleShare}
                valueStyle={{ color: '#1890ff' }}
                suffix="%"
                prefix={<FallOutlined />}
              />
            </Card>
          </Col>
          <Col span={5}>
            <Card>
              <Statistic
                title="定期占比"
                value={lockedShare}
                valueStyle={{ color: '#722ed1' }}
                suffix="%"
                prefix={<RiseOutlined />}
              />
            </Card>
          </Col>
        </Row>

        {/* 权重说明 */}
        <Card style={{ marginBottom: 16 }}>
          <Space direction="vertical" size={4}>
            <Text strong>权重计算规则：</Text>
            <Text type="secondary">
              • 无锁定期（活期）：权重 = 质押数量 × 1.0，随时可赎回
            </Text>
            <Text type="secondary">
              • 有锁定期（定期）：权重 = 质押数量 × 时间乘数（1.0x ~ 3.0x），乘数随锁定时间递增
            </Text>
            <Text type="secondary">
              • 时间乘数公式：min(1 + 锁定天数 / 180, 3.0)
            </Text>
          </Space>
        </Card>

        {/* 筛选区域 */}
        <Card style={{ marginBottom: 16 }}>
          <Space wrap>
            <Input
              placeholder="搜索用户名/ID"
              prefix={<SearchOutlined />}
              style={{ width: 200 }}
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              onPressEnter={handleSearch}
            />
            <Select
              placeholder="状态"
              style={{ width: 120 }}
              allowClear
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { label: '生效中', value: 'active' },
                { label: '已释放', value: 'unlocked' },
                { label: '解锁中', value: 'unstaking' },
              ]}
            />
            <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
              搜索
            </Button>
            <Button icon={<ReloadOutlined />} onClick={() => { loadRecords(); loadStats(); }}>
              刷新
            </Button>
          </Space>
        </Card>

        {/* 数据表格 */}
        <Table
          dataSource={dataSource}
          columns={columns}
          rowKey="id"
          pagination={{
            current: page,
            pageSize: pageSize,
            total: total,
            showSizeChanger: true,
            showTotal: (t) => `共 ${t} 条`,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
          }}
          scroll={{ x: 1400 }}
        />
      </Spin>
    </List>
  );
};
