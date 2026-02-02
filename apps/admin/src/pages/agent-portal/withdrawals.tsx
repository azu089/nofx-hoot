/**
 * 代理商 - 提现管理（精简版）
 */
import { useState, useEffect } from 'react';
import { Table, Typography, Tag, Button, Modal, Form, Input, InputNumber, Row, Col, Alert, Select } from 'antd';
import { WalletOutlined, PlusOutlined, FilterOutlined, CheckCircleOutlined, ClockCircleOutlined, DollarOutlined, BankOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

import { useMessage } from '../../hooks';
import { StatCard, PageHeader, SectionCard } from './components';
import { API_BASE, statusConfig } from './constants';

const { Text } = Typography;

interface Settlement {
  id: string;
  amount: string;
  settlementMethod: string;
  settlementAccount: string;
  status: string;
  createdAt: string;
  processedAt: string | null;
}

export default function AgentWithdrawals() {
  const message = useMessage();
  const [loading, setLoading] = useState(true);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [availableBalance, setAvailableBalance] = useState('0');
  const [modalVisible, setModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const [stats, setStats] = useState({ available: 0, totalWithdrawn: 0, processing: 0, completed: 0 });

  useEffect(() => {
    fetchSettlements();
  }, [page]);

  const fetchSettlements = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('agent_token');
      // 使用正确的 API 端点: /agent/settlements
      const response = await fetch(`${API_BASE}/agent/settlements?page=${page}&limit=20`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('获取数据失败');

      const result = await response.json();
      if (result.code === 0) {
        setSettlements(result.data.items || []);
        setTotal(result.data.total || 0);

        // 从 dashboard API 获取可提现余额
        const dashResponse = await fetch(`${API_BASE}/agent/dashboard`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (dashResponse.ok) {
          const dashResult = await dashResponse.json();
          if (dashResult.code === 0) {
            setAvailableBalance(dashResult.data.pendingCommission || '0');
          }
        }

        const items = result.data.items as Settlement[] || [];
        const totalWithdrawn = items.filter(w => w.status === 'completed').reduce((sum, w) => sum + parseFloat(w.amount || '0'), 0);
        const processing = items.filter(w => w.status === 'pending' || w.status === 'processing').reduce((sum, w) => sum + parseFloat(w.amount || '0'), 0);
        const completed = items.filter(w => w.status === 'completed').length;

        setStats({ available: parseFloat(availableBalance), totalWithdrawn, processing, completed });
      } else {
        throw new Error(result.message || '获取数据失败');
      }
    } catch (error: any) {
      message.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async (values: any) => {
    setSubmitting(true);
    try {
      const token = localStorage.getItem('agent_token');
      // 使用正确的 API 端点: POST /agent/withdrawal
      const response = await fetch(`${API_BASE}/agent/withdrawal`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: values.amount.toString(),
          settlementMethod: values.settlementMethod,
          settlementAccount: values.settlementAccount,
        }),
      });

      const result = await response.json();
      if (result.code === 0) {
        message.success('提现申请已提交');
        setModalVisible(false);
        form.resetFields();
        fetchSettlements();
      } else {
        throw new Error(result.message || '提现失败');
      }
    } catch (error: any) {
      message.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const columns: ColumnsType<Settlement> = [
    {
      title: '申请时间', dataIndex: 'createdAt', key: 'createdAt', width: 140,
      render: (date) => (
        <div>
          <div style={{ color: '#fff' }}>{new Date(date).toLocaleDateString('zh-CN')}</div>
          <Text style={{ color: '#64748b', fontSize: 11 }}>{new Date(date).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</Text>
        </div>
      ),
    },
    { title: '金额', dataIndex: 'amount', key: 'amount', width: 120, align: 'right', render: (amount) => <Text strong style={{ color: '#f59e0b', fontSize: 15 }}>${parseFloat(amount || '0').toFixed(2)}</Text> },
    { title: '结算方式', dataIndex: 'settlementMethod', key: 'settlementMethod', width: 100, render: (method) => <Tag color="blue">{method || 'USDT'}</Tag> },
    {
      title: '结算账户', dataIndex: 'settlementAccount', key: 'settlementAccount', width: 200, ellipsis: true,
      render: (account) => account ? <Text copyable style={{ color: '#94a3b8', fontSize: 12 }}>{account}</Text> : <Text style={{ color: '#64748b' }}>-</Text>,
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 100, align: 'center',
      render: (status) => {
        const config = statusConfig[status] || { label: status, color: 'default' };
        return <Tag color={config.color}>{config.label}</Tag>;
      },
    },
    {
      title: '处理时间', dataIndex: 'processedAt', key: 'processedAt', width: 120,
      render: (date) => date ? <Text style={{ color: '#94a3b8' }}>{new Date(date).toLocaleDateString('zh-CN')}</Text> : <Text style={{ color: '#64748b' }}>-</Text>,
    },
  ];

  return (
    <div>
      <PageHeader title="提现管理" icon={<WalletOutlined />}
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)} style={{ background: '#06b6d4', borderColor: '#06b6d4' }}>申请提现</Button>} />

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={12} md={6}><StatCard title="可提现金额" value={parseFloat(availableBalance)} precision={2} prefix={<DollarOutlined />} gradient="success" /></Col>
        <Col xs={12} sm={12} md={6}><StatCard title="累计已提" value={stats.totalWithdrawn} precision={2} prefix={<BankOutlined />} gradient="purple" /></Col>
        <Col xs={12} sm={12} md={6}><StatCard title="处理中" value={stats.processing} precision={2} prefix={<ClockCircleOutlined />} gradient="warning" /></Col>
        <Col xs={12} sm={12} md={6}><StatCard title="已完成" value={stats.completed} suffix="笔" prefix={<CheckCircleOutlined />} gradient="primary" /></Col>
      </Row>

      <SectionCard title="提现记录" icon={<FilterOutlined />}>
        <Table columns={columns} dataSource={settlements} rowKey="id" loading={loading}
          pagination={{ current: page, total, pageSize: 20, onChange: setPage, showTotal: (total) => `共 ${total} 条记录`, showSizeChanger: false }}
          scroll={{ x: 800 }} />
      </SectionCard>

      <Modal title="申请提现" open={modalVisible} onCancel={() => setModalVisible(false)} footer={null} styles={{ content: { background: '#12121a', border: '1px solid #1e1e2e' }, header: { background: '#12121a', borderBottom: '1px solid #1e1e2e' } }}>
        <Alert message={`可提现余额: $${parseFloat(availableBalance).toFixed(2)}`} type="info" showIcon style={{ marginBottom: 16, background: '#1a1a24', border: '1px solid #1e1e2e' }} />
        <Form form={form} layout="vertical" onFinish={handleWithdraw}>
          <Form.Item name="amount" label={<span style={{ color: '#fff' }}>提现金额 (USDT)</span>} rules={[{ required: true, message: '请输入提现金额' }]}>
            <InputNumber min={10} max={parseFloat(availableBalance)} placeholder="最低 10 USDT" style={{ width: '100%', background: '#1a1a24', borderColor: '#1e1e2e' }} />
          </Form.Item>
          <Form.Item name="settlementMethod" label={<span style={{ color: '#fff' }}>结算方式</span>} initialValue="USDT_TRC20" rules={[{ required: true, message: '请选择结算方式' }]}>
            <Select style={{ background: '#1a1a24' }} options={[
              { label: 'USDT (TRC20)', value: 'USDT_TRC20' },
              { label: 'USDT (ERC20)', value: 'USDT_ERC20' },
              { label: '银行转账', value: 'BANK' },
            ]} />
          </Form.Item>
          <Form.Item name="settlementAccount" label={<span style={{ color: '#fff' }}>结算账户</span>} rules={[{ required: true, message: '请输入结算账户' }]}>
            <Input placeholder="请输入钱包地址或银行账户" style={{ background: '#1a1a24', borderColor: '#1e1e2e' }} />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
            <Button type="primary" htmlType="submit" loading={submitting} block style={{ background: '#06b6d4', borderColor: '#06b6d4' }}>提交申请</Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
