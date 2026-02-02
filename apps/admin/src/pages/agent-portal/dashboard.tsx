/**
 * 代理商业绩概览页面 - 极简版
 * 核心数据一目了然，详情点击进入子页面
 */
import { useEffect } from 'react';
import { Row, Col, Spin, Alert, Input, Button, Tag, Typography, Card } from 'antd';
import {
  TeamOutlined, DollarOutlined, WalletOutlined, CopyOutlined, QrcodeOutlined,
  LinkOutlined, ArrowUpOutlined, ArrowDownOutlined, RightOutlined,
  FireOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

// SectionCard removed - using Card directly
import { useMessage } from '../../hooks';
import { useAgentApi, copyToClipboard } from './hooks';
import { cardStyle, agentLevelConfig, WEB_URL, colors } from './constants';

const { Text, Title } = Typography;

interface DashboardData {
  agent: { id: string; name: string; level: string; commissionRate: string; inviteCode: string };
  overview: {
    totalUsers: number; activeUsers: number; totalProfit: string; totalCommission: string;
    newUsersToday: number; newUsersThisWeek: number; newUsersThisMonth: number; subscribedUsers: number;
  };
  monthly: { sourceAmount: string; commissionAmount: string; count: number };
  today: { sourceAmount: string; commissionAmount: string; count: number };
  lastMonth?: { commissionAmount: string };
  pendingCommission: string;
  withdrawnAmount?: string;
}

export default function AgentDashboard() {
  const message = useMessage();
  const { loading, data, fetchApi } = useAgentApi<DashboardData>();
  const navigate = useNavigate();

  useEffect(() => {
    fetchApi('/agent/dashboard');
  }, []);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 100 }}>
        <Spin size="large" />
        <div style={{ marginTop: 16, color: colors.textSecondary }}>正在加载数据...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <Alert
        message="数据加载失败"
        description="请检查网络连接或重新登录后再试"
        type="error"
        showIcon
        action={
          <Button size="small" onClick={() => window.location.href = '/agent/login'}>
            重新登录
          </Button>
        }
      />
    );
  }

  const level = agentLevelConfig[data.agent.level] || agentLevelConfig.bronze;
  const inviteLink = `${WEB_URL}/register?ref=${data.agent.inviteCode || 'DEFAULT'}`;

  // 核心指标
  const totalCommission = parseFloat(data.overview.totalCommission);
  const pendingAmount = parseFloat(data.pendingCommission);
  const thisMonthCommission = parseFloat(data.monthly.commissionAmount);
  const lastMonthCommission = parseFloat(data.lastMonth?.commissionAmount || '0');
  const growthRate = lastMonthCommission > 0
    ? ((thisMonthCommission - lastMonthCommission) / lastMonthCommission * 100).toFixed(1)
    : null;

  // 功能入口卡片
  const menuItems = [
    {
      key: 'users',
      icon: <TeamOutlined style={{ fontSize: 32, color: colors.primary }} />,
      title: '推广用户',
      desc: `${data.overview.totalUsers} 人`,
      subDesc: `今日 +${data.overview.newUsersToday}`,
      path: '/agent/users',
      color: colors.primary,
    },
    {
      key: 'commissions',
      icon: <DollarOutlined style={{ fontSize: 32, color: colors.success }} />,
      title: '佣金记录',
      desc: `$${totalCommission.toFixed(2)}`,
      subDesc: `本月 +$${thisMonthCommission.toFixed(2)}`,
      path: '/agent/commissions',
      color: colors.success,
    },
    {
      key: 'withdrawals',
      icon: <WalletOutlined style={{ fontSize: 32, color: colors.warning }} />,
      title: '提现管理',
      desc: `$${pendingAmount.toFixed(2)}`,
      subDesc: '可提现余额',
      path: '/agent/withdrawals',
      color: colors.warning,
    },
  ];

  return (
    <div>
      {/* 代理身份卡片 */}
      <Card style={{ ...cardStyle, marginBottom: 16 }}>
        <Row gutter={24} align="middle">
          <Col xs={24} md={8}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ fontSize: 48 }}>{level.icon}</div>
              <div>
                <Title level={4} style={{ color: colors.textPrimary, margin: 0 }}>{data.agent.name}</Title>
                <Tag color={level.color} style={{ marginTop: 4 }}>{level.label}</Tag>
              </div>
            </div>
          </Col>
          <Col xs={12} md={8}>
            <div style={{ textAlign: 'center' }}>
              <Text style={{ color: colors.textSecondary, fontSize: 13 }}>佣金比例</Text>
              <div style={{ fontSize: 32, fontWeight: 'bold', color: colors.primary }}>
                {(parseFloat(data.agent.commissionRate) * 100).toFixed(0)}%
              </div>
            </div>
          </Col>
          <Col xs={12} md={8}>
            <div style={{ textAlign: 'center' }}>
              <Text style={{ color: colors.textSecondary, fontSize: 13 }}>本月业绩</Text>
              <div style={{ fontSize: 32, fontWeight: 'bold', color: colors.success }}>
                ${thisMonthCommission.toFixed(0)}
              </div>
              {growthRate && (
                <Tag color={parseFloat(growthRate) >= 0 ? 'green' : 'red'} style={{ marginTop: 4 }}>
                  {parseFloat(growthRate) >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                  {' '}{Math.abs(parseFloat(growthRate))}% 环比
                </Tag>
              )}
            </div>
          </Col>
        </Row>
      </Card>

      {/* 推广链接 */}
      <Card style={{ ...cardStyle, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <LinkOutlined style={{ color: colors.primary }} />
          <Text strong style={{ color: colors.textPrimary }}>我的推广链接</Text>
        </div>
        <Row gutter={16}>
          <Col xs={24} md={8}>
            <Text style={{ color: colors.textSecondary, fontSize: 12, display: 'block', marginBottom: 4 }}>邀请码</Text>
            <Input.Group compact>
              <Input value={data.agent.inviteCode || 'AGENT001'} readOnly
                style={{ width: 'calc(100% - 64px)', background: colors.bgTertiary, borderColor: colors.border, color: colors.textPrimary }} />
              <Button icon={<CopyOutlined />} style={{ background: colors.primary, borderColor: colors.primary }}
                onClick={() => copyToClipboard(data.agent.inviteCode || 'AGENT001', '邀请码', message)} />
            </Input.Group>
          </Col>
          <Col xs={24} md={16}>
            <Text style={{ color: colors.textSecondary, fontSize: 12, display: 'block', marginBottom: 4 }}>推广链接</Text>
            <Input.Group compact>
              <Input value={inviteLink} readOnly
                style={{ width: 'calc(100% - 120px)', background: colors.bgTertiary, borderColor: colors.border, color: colors.textPrimary, fontSize: 12 }} />
              <Button icon={<CopyOutlined />} style={{ background: colors.primary, borderColor: colors.primary }}
                onClick={() => copyToClipboard(inviteLink, '推广链接', message)}>复制</Button>
              <Button icon={<QrcodeOutlined />} style={{ background: colors.bgTertiary, borderColor: colors.border, color: colors.textPrimary }} />
            </Input.Group>
          </Col>
        </Row>
      </Card>

      {/* 功能入口 */}
      <Row gutter={16}>
        {menuItems.map((item) => (
          <Col xs={24} md={8} key={item.key}>
            <Card
              hoverable
              style={{ ...cardStyle, marginBottom: 16, cursor: 'pointer' }}
              onClick={() => navigate(item.path)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  {item.icon}
                  <Title level={5} style={{ color: colors.textPrimary, margin: '12px 0 4px' }}>{item.title}</Title>
                  <div style={{ fontSize: 24, fontWeight: 'bold', color: item.color }}>{item.desc}</div>
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{item.subDesc}</Text>
                </div>
                <RightOutlined style={{ color: colors.textTertiary, fontSize: 16 }} />
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* 今日速览 */}
      <Card style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <FireOutlined style={{ color: '#ff4d4f' }} />
          <Text strong style={{ color: colors.textPrimary }}>今日速览</Text>
        </div>
        <Row gutter={24}>
          {[
            { label: '新增用户', value: data.overview.newUsersToday, suffix: '人', color: colors.primary },
            { label: '产生订单', value: data.today.count, suffix: '笔', color: colors.textPrimary },
            { label: '产出金额', value: `$${parseFloat(data.today.sourceAmount).toFixed(2)}`, color: colors.textPrimary },
            { label: '佣金收入', value: `$${parseFloat(data.today.commissionAmount).toFixed(2)}`, color: colors.success },
          ].map((item, i) => (
            <Col xs={12} md={6} key={i}>
              <div style={{ textAlign: 'center', padding: '12px 0' }}>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{item.label}</Text>
                <div style={{ fontSize: 24, fontWeight: 'bold', color: item.color, marginTop: 4 }}>
                  {item.value}{item.suffix && <span style={{ fontSize: 12, fontWeight: 'normal' }}> {item.suffix}</span>}
                </div>
              </div>
            </Col>
          ))}
        </Row>
      </Card>
    </div>
  );
}
