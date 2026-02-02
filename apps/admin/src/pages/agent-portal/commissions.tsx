/**
 * 代理商 - 佣金记录（精简版）
 */
import { useState, useEffect } from 'react';
import { Table, Typography, Tag, Select, Row, Col, Button } from 'antd';
import { DollarOutlined, FilterOutlined, ExportOutlined, CheckCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

import { useMessage } from '../../hooks';
import { StatCard, PageHeader, SectionCard } from './components';
import { API_BASE, commissionTypeConfig, statusConfig } from './constants';

const { Text } = Typography;

interface Commission {
  id: string;
  user: { id: string; email: string; nickname: string };
  type: string;
  sourceAmount: string;
  commissionRate: string;
  commissionAmount: string;
  status: string;
  settledAt: string | null;
  createdAt: string;
}

export default function AgentCommissions() {
  const message = useMessage();
  const [loading, setLoading] = useState(true);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [typeFilter, setTypeFilter] = useState<string | undefined>();

  const [stats, setStats] = useState({ totalAmount: 0, pendingAmount: 0, settledAmount: 0, todayAmount: 0 });

  useEffect(() => {
    fetchCommissions();
  }, [page, statusFilter, typeFilter]);

  const fetchCommissions = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('agent_token');
      const params = new URLSearchParams({
        page: page.toString(), limit: '50',
        ...(statusFilter && { status: statusFilter }), ...(typeFilter && { type: typeFilter }),
      });

      const response = await fetch(`${API_BASE}/agent/commissions?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('获取数据失败');

      const result = await response.json();
      if (result.code === 0) {
        setCommissions(result.data.items);
        setTotal(result.data.total);

        const items = result.data.items as Commission[];
        const totalAmount = items.reduce((sum, c) => sum + parseFloat(c.commissionAmount || '0'), 0);
        const pendingAmount = items.filter(c => c.status === 'pending').reduce((sum, c) => sum + parseFloat(c.commissionAmount || '0'), 0);
        const settledAmount = items.filter(c => c.status === 'settled').reduce((sum, c) => sum + parseFloat(c.commissionAmount || '0'), 0);
        const today = new Date().toDateString();
        const todayAmount = items.filter(c => new Date(c.createdAt).toDateString() === today).reduce((sum, c) => sum + parseFloat(c.commissionAmount || '0'), 0);

        setStats({ totalAmount, pendingAmount, settledAmount, todayAmount });
      } else {
        throw new Error(result.message || '获取数据失败');
      }
    } catch (error: any) {
      message.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const columns: ColumnsType<Commission> = [
    {
      title: '时间', dataIndex: 'createdAt', key: 'createdAt', width: 140,
      render: (date) => (
        <div>
          <div style={{ color: '#fff' }}>{new Date(date).toLocaleDateString('zh-CN')}</div>
          <Text style={{ color: '#64748b', fontSize: 11 }}>{new Date(date).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</Text>
        </div>
      ),
    },
    {
      title: '来源用户', key: 'user', width: 180,
      render: (_, record) => (
        <div>
          <div style={{ color: '#fff' }}>{record.user.nickname || '未设置'}</div>
          <Text style={{ color: '#64748b', fontSize: 12 }}>{record.user.email}</Text>
        </div>
      ),
    },
    {
      title: '类型', dataIndex: 'type', key: 'type', width: 120,
      render: (type) => {
        const config = commissionTypeConfig[type] || { label: type, color: 'default' };
        return <Tag color={config.color}>{config.label}</Tag>;
      },
    },
    { title: '来源金额', dataIndex: 'sourceAmount', key: 'sourceAmount', width: 120, align: 'right', render: (amount) => <Text style={{ color: '#fff' }}>${parseFloat(amount).toFixed(2)}</Text> },
    { title: '佣金比例', dataIndex: 'commissionRate', key: 'commissionRate', width: 100, align: 'center', render: (rate) => <Tag color="cyan">{(parseFloat(rate) * 100).toFixed(0)}%</Tag> },
    { title: '佣金金额', dataIndex: 'commissionAmount', key: 'commissionAmount', width: 120, align: 'right', render: (amount) => <Text strong style={{ color: '#22c55e', fontSize: 15 }}>+${parseFloat(amount).toFixed(2)}</Text> },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 100, align: 'center',
      render: (status) => {
        const config = statusConfig[status] || { label: status, color: 'default' };
        return <Tag color={config.color}>{config.label}</Tag>;
      },
    },
    {
      title: '结算时间', dataIndex: 'settledAt', key: 'settledAt', width: 120,
      render: (date) => date ? <Text style={{ color: '#94a3b8' }}>{new Date(date).toLocaleDateString('zh-CN')}</Text> : <Text style={{ color: '#64748b' }}>-</Text>,
    },
  ];

  return (
    <div>
      <PageHeader title="佣金记录" icon={<DollarOutlined />} extra={<Button icon={<ExportOutlined />} style={{ background: '#1a1a24', borderColor: '#1e1e2e', color: '#fff' }}>导出明细</Button>} />

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={12} md={6}><StatCard title="总记录" value={total} suffix="条" gradient="primary" /></Col>
        <Col xs={12} sm={12} md={6}><StatCard title="当前页佣金" value={stats.totalAmount} precision={2} prefix={<DollarOutlined />} gradient="success" /></Col>
        <Col xs={12} sm={12} md={6}><StatCard title="待结算" value={stats.pendingAmount} precision={2} prefix={<ClockCircleOutlined />} gradient="warning" /></Col>
        <Col xs={12} sm={12} md={6}><StatCard title="已结算" value={stats.settledAmount} precision={2} prefix={<CheckCircleOutlined />} gradient="purple" /></Col>
      </Row>

      <SectionCard title="佣金明细" icon={<FilterOutlined />}>
        <div style={{ marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Select placeholder="状态筛选" allowClear style={{ width: 120 }} value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1); }}
            options={[{ label: '全部状态', value: undefined }, { label: '待结算', value: 'pending' }, { label: '已结算', value: 'settled' }, { label: '已取消', value: 'cancelled' }]} />
          <Select placeholder="类型筛选" allowClear style={{ width: 140 }} value={typeFilter} onChange={(v) => { setTypeFilter(v); setPage(1); }}
            options={[{ label: '全部类型', value: undefined }, { label: '订阅分成', value: 'subscription' }, { label: '燃油费分成', value: 'gas_fee' }, { label: '奖励', value: 'bonus' }]} />
        </div>
        <Table columns={columns} dataSource={commissions} rowKey="id" loading={loading}
          pagination={{ current: page, total, pageSize: 50, onChange: setPage, showTotal: (total) => `共 ${total} 条记录`, showSizeChanger: false }}
          scroll={{ x: 1000 }} />
      </SectionCard>
    </div>
  );
}
