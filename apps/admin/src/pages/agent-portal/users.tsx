/**
 * 代理商 - 推广用户列表（精简版）
 */
import { useState, useEffect } from 'react';
import { Table, Input, Typography, Tag, Row, Col, Select, Button, Badge } from 'antd';
import { TeamOutlined, SearchOutlined, ExportOutlined, FilterOutlined, UserOutlined, FireOutlined, CheckCircleOutlined, DollarOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

import { useMessage } from '../../hooks';
import { StatCard, PageHeader, SectionCard } from './components';
import { API_BASE } from './constants';

const { Text } = Typography;
const { Search } = Input;

interface User {
  id: string;
  email: string;
  nickname: string;
  usdtBalance: string;
  subscriptionCount: number;
  positionCount: number;
  contribution: { sourceAmount: string; commissionAmount: string; count: number };
  createdAt: string;
  lastActiveAt: string | null;
}

export default function AgentUsers() {
  const message = useMessage();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [sortBy, setSortBy] = useState<string>('createdAt');

  const [stats, setStats] = useState({ totalUsers: 0, activeUsers: 0, subscribedUsers: 0, totalContribution: 0 });

  useEffect(() => {
    fetchUsers();
  }, [page, search, statusFilter, sortBy]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('agent_token');
      const params = new URLSearchParams({
        page: page.toString(), limit: '20',
        ...(search && { search }), ...(statusFilter && { status: statusFilter }), ...(sortBy && { sortBy }),
      });

      const response = await fetch(`${API_BASE}/agent/users?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('获取数据失败');

      const result = await response.json();
      if (result.code === 0) {
        setUsers(result.data.items);
        setTotal(result.data.total);

        const items = result.data.items as User[];
        const contribution = items.reduce((sum, u) => sum + parseFloat(u.contribution.commissionAmount || '0'), 0);
        const active = items.filter(u => {
          if (!u.lastActiveAt) return false;
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          return new Date(u.lastActiveAt) > sevenDaysAgo;
        }).length;
        const subscribed = items.filter(u => u.subscriptionCount > 0).length;

        setStats({ totalUsers: result.data.total, activeUsers: active, subscribedUsers: subscribed, totalContribution: contribution });
      } else {
        throw new Error(result.message || '获取数据失败');
      }
    } catch (error: any) {
      message.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const isUserActive = (lastActiveAt: string | null): boolean => {
    if (!lastActiveAt) return false;
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return new Date(lastActiveAt) > sevenDaysAgo;
  };

  const getUserValueLevel = (contribution: number) => {
    if (contribution >= 100) return { level: '高价值', color: '#ffd700' };
    if (contribution >= 50) return { level: '中价值', color: '#06b6d4' };
    if (contribution >= 10) return { level: '潜力', color: '#22c55e' };
    return { level: '新用户', color: '#64748b' };
  };

  const columns: ColumnsType<User> = [
    {
      title: '用户信息', key: 'user', width: 220,
      render: (_, record) => {
        const active = isUserActive(record.lastActiveAt);
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Badge dot status={active ? 'success' : 'default'} offset={[-2, 28]}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#1a1a24', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #1e1e2e' }}>
                <UserOutlined style={{ color: '#94a3b8' }} />
              </div>
            </Badge>
            <div>
              <Text strong style={{ color: '#fff' }}>{record.nickname || '未设置昵称'}</Text>
              <div><Text style={{ color: '#64748b', fontSize: 12 }}>{record.email}</Text></div>
            </div>
          </div>
        );
      },
    },
    {
      title: '状态', key: 'status', width: 100, align: 'center',
      render: (_, record) => <Tag color={isUserActive(record.lastActiveAt) ? 'green' : 'default'}>{isUserActive(record.lastActiveAt) ? '活跃' : '沉睡'}</Tag>,
    },
    {
      title: '订阅策略', dataIndex: 'subscriptionCount', key: 'subscriptionCount', width: 100, align: 'center',
      render: (count) => (
        <span style={{ fontSize: 18, fontWeight: 'bold', color: count > 0 ? '#06b6d4' : '#64748b' }}>
          {count}<span style={{ color: '#64748b', fontSize: 12 }}> 个</span>
        </span>
      ),
    },
    { title: '交易次数', dataIndex: 'positionCount', key: 'positionCount', width: 100, align: 'center', render: (count) => <Text style={{ color: '#fff' }}>{count} 笔</Text> },
    {
      title: '贡献产出', key: 'sourceAmount', width: 120, align: 'right',
      render: (_, record) => <Text style={{ color: '#fff' }}>${parseFloat(record.contribution.sourceAmount).toFixed(2)}</Text>,
    },
    {
      title: '贡献佣金', key: 'commissionAmount', width: 120, align: 'right',
      render: (_, record) => {
        const amount = parseFloat(record.contribution.commissionAmount);
        const valueLevel = getUserValueLevel(amount);
        return (
          <div>
            <Text strong style={{ color: '#22c55e' }}>+${amount.toFixed(2)}</Text>
            <div><Tag style={{ fontSize: 10, padding: '0 4px', background: 'transparent', border: `1px solid ${valueLevel.color}`, color: valueLevel.color }}>{valueLevel.level}</Tag></div>
          </div>
        );
      },
    },
    {
      title: '注册时间', dataIndex: 'createdAt', key: 'createdAt', width: 110,
      render: (date) => (
        <div>
          <div style={{ color: '#fff' }}>{new Date(date).toLocaleDateString('zh-CN')}</div>
          <Text style={{ color: '#64748b', fontSize: 11 }}>{new Date(date).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</Text>
        </div>
      ),
    },
    {
      title: '最后活跃', dataIndex: 'lastActiveAt', key: 'lastActiveAt', width: 110,
      render: (date) => {
        if (!date) return <Text style={{ color: '#64748b' }}>-</Text>;
        const diffDays = Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
        const timeAgo = diffDays === 0 ? '今天' : diffDays === 1 ? '昨天' : diffDays < 7 ? `${diffDays}天前` : new Date(date).toLocaleDateString('zh-CN');
        return <Text style={{ color: diffDays < 7 ? '#22c55e' : '#64748b' }}>{timeAgo}</Text>;
      },
    },
  ];

  return (
    <div>
      <PageHeader title="推广用户" icon={<TeamOutlined />} extra={<Button icon={<ExportOutlined />} style={{ background: '#1a1a24', borderColor: '#1e1e2e', color: '#fff' }}>导出数据</Button>} />

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={12} md={6}><StatCard title="总用户数" value={stats.totalUsers} prefix={<TeamOutlined />} suffix="人" gradient="primary" /></Col>
        <Col xs={12} sm={12} md={6}><StatCard title="活跃用户" value={stats.activeUsers} prefix={<FireOutlined />} suffix="人" gradient="success" extra={<Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>7天内有活动</Text>} /></Col>
        <Col xs={12} sm={12} md={6}><StatCard title="已订阅" value={stats.subscribedUsers} prefix={<CheckCircleOutlined />} suffix="人" gradient="warning" extra={<Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>有订阅策略</Text>} /></Col>
        <Col xs={12} sm={12} md={6}><StatCard title="当页贡献" value={stats.totalContribution} precision={2} prefix={<DollarOutlined />} gradient="purple" /></Col>
      </Row>

      <SectionCard title="用户列表" icon={<FilterOutlined />}>
        <div style={{ marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Search placeholder="搜索邮箱或昵称" allowClear enterButton={<SearchOutlined />} style={{ width: 280 }} onSearch={(v) => { setSearch(v); setPage(1); }} />
          <Select placeholder="用户状态" allowClear style={{ width: 120 }} value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1); }}
            options={[{ label: '全部状态', value: undefined }, { label: '活跃用户', value: 'active' }, { label: '沉睡用户', value: 'inactive' }]} />
          <Select placeholder="排序方式" style={{ width: 140 }} value={sortBy} onChange={(v) => { setSortBy(v); setPage(1); }}
            options={[{ label: '注册时间', value: 'createdAt' }, { label: '贡献金额', value: 'contribution' }, { label: '最近活跃', value: 'lastActive' }, { label: '订阅数量', value: 'subscriptions' }]} />
        </div>
        <Table columns={columns} dataSource={users} rowKey="id" loading={loading}
          pagination={{ current: page, total, pageSize: 20, onChange: setPage, showTotal: (total) => `共 ${total} 个用户`, showSizeChanger: false }}
          scroll={{ x: 1000 }} />
      </SectionCard>
    </div>
  );
}
