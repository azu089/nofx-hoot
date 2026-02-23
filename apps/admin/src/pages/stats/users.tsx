/**
 * 用户数据看板页面
 * 总用户、日注册、日登录、活跃用户等统计
 */
import { useState, useEffect } from 'react';
import {
  Card,
  Col,
  Row,
  Statistic,
  Typography,
  Table,
  Tag,
  Space,
  Spin,
  Progress,
  Empty,
} from 'antd';
import {
  UserOutlined,
  TeamOutlined,
  RiseOutlined,
  TrophyOutlined,
  ReloadOutlined,
  ShareAltOutlined,
  DollarOutlined,
  BarChartOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import { api } from '../../lib/api';
import { useMessage } from '../../hooks';

const { Title, Text } = Typography;

// 用户看板数据类型
interface UserDashboard {
  overview: {
    totalUsers: number;
    todayRegistrations: number;
    registrationGrowth: string;
    activeUsers7d: number;
    tradingUsers: number;
  };
  usersByStatus: Array<{
    status: string;
    count: number;
  }>;
  topReferrers: Array<{
    id: string;
    email: string;
    nickname: string;
    inviteCode: string;
    inviteeCount: number;
    totalReward: string;
  }>;
  recentRegistrations: Array<{
    id: string;
    email: string;
    nickname: string;
    telegramUsername: string | null;
    walletAddress: string | null;
    status: string;
    createdAt: string;
  }>;
}

// 用户来源统计
interface UserSourceStats {
  email: number;
  telegram: number;
  wallet: number;
}

// 用户增长趋势
interface TrendItem {
  date: string;
  totalUsers: number;
  newUsers: number;
  activeUsers: number;
  tradingUsers: number;
}

// 用户资产分布
interface AssetDistribution {
  distribution: Array<{ label: string; count: number }>;
  totals: { usdt: string; hoot: string; points: string };
}

export const UserStatsPage = () => {
  const message = useMessage();
  const [data, setData] = useState<UserDashboard | null>(null);
  const [sourceStats, setSourceStats] = useState<UserSourceStats | null>(null);
  const [trendData, setTrendData] = useState<TrendItem[]>([]);
  const [assetData, setAssetData] = useState<AssetDistribution | null>(null);
  const [loading, setLoading] = useState(true);

  // 获取用户统计数据
  const fetchUserStats = async () => {
    setLoading(true);
    try {
      const [dashboard, source, trend, assets] = await Promise.all([
        api.get<UserDashboard>('/admin/stats/users'),
        api.get<UserSourceStats>('/admin/stats/users/source'),
        api.get<TrendItem[]>('/admin/stats/users/trend?days=30').catch(() => []),
        api.get<AssetDistribution>('/admin/stats/users/assets').catch(() => null),
      ]);
      setData(dashboard);
      setSourceStats(source);
      setTrendData(trend || []);
      setAssetData(assets);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '获取数据失败';
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserStats();
  }, []);

  // 邀请排行榜列
  const referrerColumns = [
    {
      title: '排名',
      key: 'rank',
      width: 60,
      render: (_: any, __: any, index: number) => (
        <Tag color={index < 3 ? 'gold' : 'default'}>{index + 1}</Tag>
      ),
    },
    {
      title: '用户',
      key: 'user',
      render: (record: any) => (
        <Space direction="vertical" size={0}>
          <Text>{record.nickname || record.email}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.inviteCode}</Text>
        </Space>
      ),
    },
    {
      title: '邀请人数',
      dataIndex: 'inviteeCount',
      key: 'inviteeCount',
      render: (val: number) => <Tag color="blue">{val} 人</Tag>,
    },
    {
      title: '获得返佣',
      dataIndex: 'totalReward',
      key: 'totalReward',
      render: (val: string) => (
        <Text style={{ color: '#52c41a' }}>${parseFloat(val).toFixed(2)}</Text>
      ),
    },
  ];

  // 最近注册用户列
  const recentColumns = [
    {
      title: '用户',
      key: 'user',
      render: (record: any) => (
        <Space direction="vertical" size={0}>
          <Text>{record.nickname || record.email || '-'}</Text>
          {record.telegramUsername && (
            <Text type="secondary" style={{ fontSize: 12 }}>@{record.telegramUsername}</Text>
          )}
        </Space>
      ),
    },
    {
      title: '注册方式',
      key: 'type',
      render: (record: any) => {
        if (record.walletAddress) return <Tag color="purple">钱包</Tag>;
        if (record.telegramUsername) return <Tag color="blue">Telegram</Tag>;
        return <Tag color="cyan">邮箱</Tag>;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (val: string) => (
        <Tag color={val === 'active' ? 'green' : val === 'frozen' ? 'red' : 'default'}>
          {val === 'active' ? '正常' : val === 'frozen' ? '冻结' : val}
        </Tag>
      ),
    },
    {
      title: '注册时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (val: string) => new Date(val).toLocaleString('zh-CN'),
    },
  ];

  // 计算来源占比
  const totalSource = (sourceStats?.email || 0) + (sourceStats?.telegram || 0) + (sourceStats?.wallet || 0);
  const getSourcePercent = (val: number) => totalSource > 0 ? ((val / totalSource) * 100).toFixed(1) : '0';

  return (
    <div style={{ padding: '24px' }}>
      {/* 标题 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>
          <TeamOutlined style={{ marginRight: 8 }} />
          用户数据看板
        </Title>
        <Tag
          icon={<ReloadOutlined spin={loading} />}
          color="blue"
          style={{ cursor: 'pointer' }}
          onClick={fetchUserStats}
        >
          刷新
        </Tag>
      </div>

      <Spin spinning={loading}>
        {/* 核心指标 */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} md={5}>
            <Card size="small">
              <Statistic
                title={<span style={{ color: '#999' }}>总用户数</span>}
                value={data?.overview.totalUsers || 0}
                prefix={<UserOutlined />}
                valueStyle={{ color: '#1890ff', fontSize: 28 }}
              />
            </Card>
          </Col>
          <Col xs={24} md={5}>
            <Card size="small">
              <Statistic
                title={<span style={{ color: '#999' }}>今日注册</span>}
                value={data?.overview.todayRegistrations || 0}
                prefix={<RiseOutlined />}
                valueStyle={{ color: '#52c41a', fontSize: 28 }}
              />
              <div style={{ marginTop: 4 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  较昨日 {data?.overview.registrationGrowth || '0%'}
                </Text>
              </div>
            </Card>
          </Col>
          <Col xs={24} md={5}>
            <Card size="small">
              <Statistic
                title={<span style={{ color: '#999' }}>7日活跃</span>}
                value={data?.overview.activeUsers7d || 0}
                prefix={<TeamOutlined />}
                valueStyle={{ color: '#722ed1', fontSize: 28 }}
              />
            </Card>
          </Col>
          <Col xs={24} md={5}>
            <Card size="small">
              <Statistic
                title={<span style={{ color: '#999' }}>交易用户</span>}
                value={data?.overview.tradingUsers || 0}
                prefix={<TrophyOutlined />}
                valueStyle={{ color: '#faad14', fontSize: 28 }}
              />
            </Card>
          </Col>
          <Col xs={24} md={4}>
            <Card size="small">
              <div style={{ textAlign: 'center' }}>
                <Text type="secondary" style={{ fontSize: 13 }}>转化率</Text>
                <div style={{ fontSize: 28, color: '#13c2c2', fontWeight: 600 }}>
                  {data?.overview.totalUsers
                    ? ((data.overview.tradingUsers / data.overview.totalUsers) * 100).toFixed(1)
                    : '0'}%
                </div>
              </div>
            </Card>
          </Col>
        </Row>

        {/* 用户来源和状态 */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} md={12}>
            <Card title="用户来源分布" size="small">
              <Row gutter={16}>
                <Col span={8}>
                  <div style={{ textAlign: 'center' }}>
                    <Progress
                      type="circle"
                      percent={parseFloat(getSourcePercent(sourceStats?.email || 0))}
                      size={80}
                      strokeColor="#1890ff"
                    />
                    <div style={{ marginTop: 8 }}>
                      <Text>邮箱注册</Text>
                      <br />
                      <Text strong>{sourceStats?.email || 0}</Text>
                    </div>
                  </div>
                </Col>
                <Col span={8}>
                  <div style={{ textAlign: 'center' }}>
                    <Progress
                      type="circle"
                      percent={parseFloat(getSourcePercent(sourceStats?.telegram || 0))}
                      size={80}
                      strokeColor="#722ed1"
                    />
                    <div style={{ marginTop: 8 }}>
                      <Text>Telegram</Text>
                      <br />
                      <Text strong>{sourceStats?.telegram || 0}</Text>
                    </div>
                  </div>
                </Col>
                <Col span={8}>
                  <div style={{ textAlign: 'center' }}>
                    <Progress
                      type="circle"
                      percent={parseFloat(getSourcePercent(sourceStats?.wallet || 0))}
                      size={80}
                      strokeColor="#52c41a"
                    />
                    <div style={{ marginTop: 8 }}>
                      <Text>钱包连接</Text>
                      <br />
                      <Text strong>{sourceStats?.wallet || 0}</Text>
                    </div>
                  </div>
                </Col>
              </Row>
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card title="用户状态分布" size="small">
              {data?.usersByStatus?.map((item) => (
                <div
                  key={item.status}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 0',
                    borderBottom: '1px solid #303030',
                  }}
                >
                  <Space>
                    <Tag
                      color={
                        item.status === 'active' ? 'green' :
                        item.status === 'frozen' ? 'red' :
                        item.status === 'banned' ? 'volcano' : 'default'
                      }
                    >
                      {item.status === 'active' ? '正常' :
                       item.status === 'frozen' ? '冻结' :
                       item.status === 'banned' ? '封禁' : item.status}
                    </Tag>
                  </Space>
                  <Text strong>{item.count} 人</Text>
                </div>
              )) || <Empty description="暂无数据" />}
            </Card>
          </Col>
        </Row>

        {/* C1: 用户增长趋势 */}
        {trendData.length > 0 && (
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col span={24}>
              <Card
                title={
                  <span>
                    <BarChartOutlined style={{ marginRight: 8 }} />
                    用户增长趋势（近 30 天）
                  </span>
                }
                size="small"
              >
                {/* 简易条形图 — 新增用户 */}
                <div style={{ marginBottom: 16 }}>
                  <Text type="secondary" style={{ fontSize: 12, marginBottom: 8, display: 'block' }}>
                    每日新增用户
                  </Text>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 100 }}>
                    {(() => {
                      const maxNew = Math.max(...trendData.map((d) => d.newUsers), 1);
                      return trendData.map((item) => {
                        const height = Math.max((item.newUsers / maxNew) * 80, 2);
                        return (
                          <div
                            key={item.date}
                            title={`${item.date}: 新增 ${item.newUsers} 人`}
                            style={{
                              flex: 1,
                              height,
                              background: '#1890ff',
                              borderRadius: '2px 2px 0 0',
                              cursor: 'pointer',
                              minWidth: 4,
                            }}
                          />
                        );
                      });
                    })()}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                    <Text type="secondary" style={{ fontSize: 10 }}>
                      {trendData[0]?.date}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 10 }}>
                      {trendData[trendData.length - 1]?.date}
                    </Text>
                  </div>
                </div>
                {/* 汇总数据表 — 最近 7 天 */}
                <Table
                  size="small"
                  pagination={false}
                  dataSource={trendData.slice(-7)}
                  rowKey="date"
                  columns={[
                    { title: '日期', dataIndex: 'date', key: 'date', width: 120 },
                    {
                      title: '总用户',
                      dataIndex: 'totalUsers',
                      key: 'totalUsers',
                      render: (v: number) => <Text strong>{v}</Text>,
                    },
                    {
                      title: '新增',
                      dataIndex: 'newUsers',
                      key: 'newUsers',
                      render: (v: number) => (
                        <Text style={{ color: v > 0 ? '#52c41a' : undefined }}>
                          {v > 0 ? `+${v}` : v}
                        </Text>
                      ),
                    },
                    {
                      title: '活跃',
                      dataIndex: 'activeUsers',
                      key: 'activeUsers',
                    },
                    {
                      title: '交易用户',
                      dataIndex: 'tradingUsers',
                      key: 'tradingUsers',
                    },
                  ]}
                />
              </Card>
            </Col>
          </Row>
        )}

        {/* C2: 用户资产分布 */}
        {assetData && (
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} md={14}>
              <Card
                title={
                  <span>
                    <WalletOutlined style={{ marginRight: 8 }} />
                    用户资产分布
                  </span>
                }
                size="small"
              >
                {(() => {
                  const maxCount = Math.max(...assetData.distribution.map((d) => d.count), 1);
                  const COLORS = ['#d9d9d9', '#1890ff', '#52c41a', '#faad14', '#f5222d'];
                  return assetData.distribution.map((item, idx) => (
                    <div
                      key={item.label}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        marginBottom: 12,
                      }}
                    >
                      <Text style={{ width: 90, fontSize: 13 }}>
                        ${item.label}
                      </Text>
                      <Progress
                        percent={Math.round((item.count / maxCount) * 100)}
                        strokeColor={COLORS[idx] || '#1890ff'}
                        showInfo={false}
                        style={{ flex: 1, marginRight: 12 }}
                      />
                      <Text strong style={{ width: 60, textAlign: 'right' }}>
                        {item.count} 人
                      </Text>
                    </div>
                  ));
                })()}
              </Card>
            </Col>
            <Col xs={24} md={10}>
              <Card
                title={
                  <span>
                    <DollarOutlined style={{ marginRight: 8 }} />
                    平台资产总计
                  </span>
                }
                size="small"
              >
                <Space direction="vertical" size={16} style={{ width: '100%' }}>
                  <Statistic
                    title="USDT 总额"
                    value={parseFloat(assetData.totals.usdt).toFixed(2)}
                    prefix="$"
                    valueStyle={{ color: '#52c41a', fontSize: 22 }}
                  />
                  <Statistic
                    title="HOOT 总额"
                    value={parseFloat(assetData.totals.hoot).toFixed(2)}
                    valueStyle={{ color: '#1890ff', fontSize: 22 }}
                  />
                  <Statistic
                    title="积分总额"
                    value={parseFloat(assetData.totals.points).toFixed(2)}
                    valueStyle={{ color: '#faad14', fontSize: 22 }}
                  />
                </Space>
              </Card>
            </Col>
          </Row>
        )}

        {/* 排行榜和最近注册 */}
        <Row gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <Card
              title={
                <span>
                  <ShareAltOutlined style={{ marginRight: 8 }} />
                  邀请排行榜
                </span>
              }
              size="small"
            >
              <Table
                columns={referrerColumns}
                dataSource={data?.topReferrers || []}
                rowKey="id"
                size="small"
                pagination={false}
                locale={{ emptyText: <Empty description="暂无数据" /> }}
              />
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card
              title={
                <span>
                  <UserOutlined style={{ marginRight: 8 }} />
                  最近注册用户
                </span>
              }
              size="small"
            >
              <Table
                columns={recentColumns}
                dataSource={data?.recentRegistrations || []}
                rowKey="id"
                size="small"
                pagination={false}
                locale={{ emptyText: <Empty description="暂无数据" /> }}
              />
            </Card>
          </Col>
        </Row>
      </Spin>
    </div>
  );
};
