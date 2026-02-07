/**
 * 生态配置页面
 * 质押分红比例、邀请返佣配置
 * 已对接真实 API:
 * - GET /admin/ecosystem/staking/config
 * - PUT /admin/ecosystem/staking/config
 * - GET /admin/referral/config
 * - PUT /admin/referral/config
 * - GET /admin/ecosystem/stats
 * - GET /admin/ecosystem/config-history
 */
import {
  Card,
  Form,
  InputNumber,
  Button,
  Space,
  Typography,
  Divider,
  Alert,
  Modal,
  Row,
  Col,
  Statistic,
  Table,
  Tag,
  Switch,
  Select,
  Spin,
} from 'antd';
import {
  SaveOutlined,
  ExclamationCircleOutlined,
  PercentageOutlined,
  TeamOutlined,
  GiftOutlined,
  DollarOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useState, useEffect, useCallback } from 'react';
import { api } from '../../lib/api';
import { useMessage } from '../../hooks';

const { Title } = Typography;

// 质押分红配置
interface IStakingConfig {
  // 收入分配比例
  dividendPoolRatio: number;    // 分红池比例 (40%)
  buybackRatio: number;         // 回购销毁比例 (10%)
  platformRatio: number;        // 平台比例 (50%)

  // 质押配置（单一模式，通过锁定期区分权重）
  staking: {
    enabled: boolean;
    minAmount: number;          // 最小质押量
    minLockDays: number;        // 最小锁定天数（0=可随时赎回）
    maxLockDays: number;        // 最大锁定天数
    maxMultiplier: number;      // 最大权重乘数 (3.0x)
  };

  // 分红执行
  dividendCycle: 'daily' | 'weekly' | 'monthly';
  minDividendAmount: number;    // 最小分红金额
}

// 邀请返佣配置
interface IReferralConfig {
  isActive: boolean;
  level1Rate: string;
  level2Rate: string;
  level3Rate: string;
  enabledTypes: string[];
}

// 统计数据
interface IEcosystemStats {
  totalDividendPaid: string;
  totalCommissionPaid: string;
  avgDailyDividend: string;
  avgDailyCommission: string;
  activeStakers: number;
  activeReferrers: number;
}

// 配置变更历史
interface IConfigHistory {
  id: string;
  time: string;
  type: string;
  change: string;
  operator: string;
}

export const EcosystemConfigPage = () => {
  const message = useMessage();
  const [stakingForm] = Form.useForm();
  const [referralForm] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState<IEcosystemStats | null>(null);
  const [configHistory, setConfigHistory] = useState<IConfigHistory[]>([]);

  // 存储加载的配置数据
  const [ecosystemPageEnabled, setEcosystemPageEnabled] = useState(false);
  const [ecosystemToggleLoading, setEcosystemToggleLoading] = useState(false);
  const [stakingConfig, setStakingConfig] = useState<IStakingConfig | null>(null);
  const [referralConfig, setReferralConfig] = useState<{
    enabled: boolean;
    level1Ratio: number;
    level2Ratio: number;
    level3Ratio: number;
    sourceType: string;
  } | null>(null);

  // 加载数据
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [stakingRes, referralRes, statsRes, historyRes, ecosystemToggleRes] = await Promise.all([
        api.get<{ code: number; data: IStakingConfig }>('/admin/ecosystem/staking/config'),
        api.get<IReferralConfig>('/admin/referral/config'),
        api.get<{ code: number; data: IEcosystemStats }>('/admin/ecosystem/stats'),
        api.get<{ code: number; data: IConfigHistory[] }>('/admin/ecosystem/config-history'),
        api.get<boolean>('/admin/config/ecosystem_page_enabled').catch(() => false),
      ]);

      // 设置生态页面开关状态
      setEcosystemPageEnabled(ecosystemToggleRes === true || String(ecosystemToggleRes) === 'true');

      // 存储质押配置（兼容旧版 typeA/typeB 格式）
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawConfig: any = stakingRes.data || stakingRes;
      const sConfig: IStakingConfig = {
        dividendPoolRatio: rawConfig.dividendPoolRatio,
        buybackRatio: rawConfig.buybackRatio,
        platformRatio: rawConfig.platformRatio,
        staking: rawConfig.staking || {
          enabled: rawConfig.typeA?.enabled ?? rawConfig.typeB?.enabled ?? true,
          minAmount: rawConfig.typeA?.minAmount ?? rawConfig.typeB?.minAmount ?? 100,
          minLockDays: rawConfig.typeB?.minLockDays ?? 0,
          maxLockDays: rawConfig.typeB?.maxLockDays ?? 365,
          maxMultiplier: rawConfig.typeB?.maxMultiplier ?? 3.0,
        },
        dividendCycle: rawConfig.dividendCycle,
        minDividendAmount: rawConfig.minDividendAmount,
      };
      setStakingConfig(sConfig);

      // 存储返佣配置
      const rConfig = referralRes;
      setReferralConfig({
        enabled: rConfig.isActive,
        level1Ratio: parseFloat(rConfig.level1Rate),
        level2Ratio: parseFloat(rConfig.level2Rate),
        level3Ratio: parseFloat(rConfig.level3Rate),
        sourceType: rConfig.enabledTypes?.includes('gas_fee') ? 'gas_fee' : 'subscription',
      });

      // 设置统计数据
      setStats(statsRes.data || statsRes);

      // 设置配置变更历史
      setConfigHistory(historyRes.data || historyRes || []);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '加载配置失败';
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 表单渲染后设置值（避免 useForm not connected 警告）
  useEffect(() => {
    if (!loading && stakingConfig) {
      stakingForm.setFieldsValue(stakingConfig);
    }
  }, [loading, stakingConfig, stakingForm]);

  useEffect(() => {
    if (!loading && referralConfig) {
      referralForm.setFieldsValue(referralConfig);
    }
  }, [loading, referralConfig, referralForm]);

  // 验证分红比例总和
  const validateRatios = () => {
    const values = stakingForm.getFieldsValue();
    const total = (values.dividendPoolRatio || 0) + (values.buybackRatio || 0) + (values.platformRatio || 0);
    return total === 100;
  };

  const handleSaveStaking = async () => {
    try {
      await stakingForm.validateFields();

      if (!validateRatios()) {
        message.error('分红池 + 回购销毁 + 平台比例必须等于 100%');
        return;
      }

      Modal.confirm({
        title: '确认保存质押分红配置',
        icon: <ExclamationCircleOutlined />,
        content: (
          <div>
            <Alert
              message="重要提示"
              description="修改分红配置将在下一个分红周期生效，请确认配置正确。"
              type="warning"
              showIcon
              style={{ marginTop: 16 }}
            />
          </div>
        ),
        okText: '确认保存',
        cancelText: '取消',
        onOk: async () => {
          setSaving(true);
          try {
            const values = stakingForm.getFieldsValue();
            await api.put('/admin/ecosystem/staking/config', values);
            message.success('质押分红配置已保存');
            // 刷新配置历史
            fetchData();
          } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : '保存失败';
            message.error(errorMessage);
          } finally {
            setSaving(false);
          }
        },
      });
    } catch (error) {
      console.error('验证失败:', error);
    }
  };

  const handleSaveReferral = async () => {
    try {
      await referralForm.validateFields();

      Modal.confirm({
        title: '确认保存邀请返佣配置',
        icon: <ExclamationCircleOutlined />,
        content: (
          <div>
            <Alert
              message="重要提示"
              description="修改返佣配置将立即生效，新产生的交易将按新配置计算返佣。"
              type="warning"
              showIcon
              style={{ marginTop: 16 }}
            />
          </div>
        ),
        okText: '确认保存',
        cancelText: '取消',
        onOk: async () => {
          setSaving(true);
          try {
            const values = referralForm.getFieldsValue();
            await api.put('/admin/referral/config', {
              level1Rate: values.level1Ratio,
              level2Rate: values.level2Ratio,
              level3Rate: values.level3Ratio || 0,
              enabledTypes: [values.sourceType],
              isActive: values.enabled,
            });
            message.success('邀请返佣配置已保存');
            // 刷新数据
            fetchData();
          } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : '保存失败';
            message.error(errorMessage);
          } finally {
            setSaving(false);
          }
        },
      });
    } catch (error) {
      console.error('验证失败:', error);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>生态配置</Title>
        <Button
          icon={<ReloadOutlined spin={loading} />}
          onClick={fetchData}
        >
          刷新
        </Button>
      </div>

      {/* 页面显示控制 */}
      <Card style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Typography.Text strong>生态中心页面</Typography.Text>
            <br />
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              关闭后用户端将显示「敬请期待」占位页
            </Typography.Text>
          </div>
          <Switch
            checked={ecosystemPageEnabled}
            loading={ecosystemToggleLoading}
            checkedChildren="已开启"
            unCheckedChildren="已关闭"
            onChange={async (checked) => {
              setEcosystemToggleLoading(true);
              try {
                await api.put('/admin/config/ecosystem_page_enabled', { value: checked });
                setEcosystemPageEnabled(checked);
                message.success(checked ? '生态中心页面已开启' : '生态中心页面已关闭');
              } catch {
                message.error('切换失败');
              } finally {
                setEcosystemToggleLoading(false);
              }
            }}
          />
        </div>
      </Card>

      {/* 统计概览 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="累计分红发放"
              value={parseFloat(stats?.totalDividendPaid || '0')}
              precision={2}
              prefix={<DollarOutlined />}
              suffix="USDT"
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="累计返佣发放"
              value={parseFloat(stats?.totalCommissionPaid || '0')}
              precision={2}
              prefix={<GiftOutlined />}
              suffix="USDT"
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="活跃质押用户"
              value={stats?.activeStakers || 0}
              prefix={<TeamOutlined />}
              suffix="人"
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="活跃邀请人"
              value={stats?.activeReferrers || 0}
              prefix={<TeamOutlined />}
              suffix="人"
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      <Spin spinning={loading}>
      <Row gutter={24}>
        {/* 质押分红配置 */}
        <Col span={12}>
          <Card
            title={
              <Space>
                <PercentageOutlined />
                <span>质押分红配置</span>
              </Space>
            }
            extra={
              <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={handleSaveStaking}
                loading={saving}
              >
                保存配置
              </Button>
            }
          >
            <Form
              form={stakingForm}
              layout="vertical"
            >
              <Title level={5}>收入分配比例</Title>
              <Alert
                message="收入分配比例总和必须等于 100%"
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
              />

              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item
                    label="分红池比例"
                    name="dividendPoolRatio"
                    rules={[{ required: true, message: '请输入' }]}
                    extra="分配给质押用户"
                  >
                    <InputNumber
                      min={0}
                      max={100}
                      precision={0}
                      style={{ width: '100%' }}
                      suffix="%"
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    label="回购销毁比例"
                    name="buybackRatio"
                    rules={[{ required: true, message: '请输入' }]}
                    extra="用于回购销毁HOOT"
                  >
                    <InputNumber
                      min={0}
                      max={100}
                      precision={0}
                      style={{ width: '100%' }}
                      suffix="%"
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    label="平台比例"
                    name="platformRatio"
                    rules={[{ required: true, message: '请输入' }]}
                    extra="平台运营收入"
                  >
                    <InputNumber
                      min={0}
                      max={100}
                      precision={0}
                      style={{ width: '100%' }}
                      suffix="%"
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Divider />

              <Title level={5}>HOOT 质押配置</Title>
              <Alert
                message="质押权重规则：权重 = min(1 + 锁定天数 / 180, 最大乘数)，锁定天数为 0 时权重固定 1.0x"
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
              />
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item
                    label="启用状态"
                    name={['staking', 'enabled']}
                    valuePropName="checked"
                  >
                    <Switch checkedChildren="启用" unCheckedChildren="禁用" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    label="最小质押量"
                    name={['staking', 'minAmount']}
                    rules={[{ required: true, message: '请输入' }]}
                  >
                    <InputNumber
                      min={0}
                      style={{ width: '100%' }}
                      suffix="HOOT"
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    label="最大权重乘数"
                    name={['staking', 'maxMultiplier']}
                    rules={[{ required: true, message: '请输入' }]}
                    extra="锁定时间越长乘数越高"
                  >
                    <InputNumber
                      min={1}
                      max={10}
                      precision={1}
                      style={{ width: '100%' }}
                      suffix="x"
                    />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item
                    label="最小锁定天数"
                    name={['staking', 'minLockDays']}
                    rules={[{ required: true, message: '请输入' }]}
                    extra="设为 0 表示可随时赎回"
                  >
                    <InputNumber
                      min={0}
                      style={{ width: '100%' }}
                      suffix="天"
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    label="最大锁定天数"
                    name={['staking', 'maxLockDays']}
                    rules={[{ required: true, message: '请输入' }]}
                  >
                    <InputNumber
                      min={1}
                      style={{ width: '100%' }}
                      suffix="天"
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Divider />

              <Title level={5}>分红执行</Title>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    label="分红周期"
                    name="dividendCycle"
                    rules={[{ required: true, message: '请选择' }]}
                  >
                    <Select
                      options={[
                        { label: '每日', value: 'daily' },
                        { label: '每周', value: 'weekly' },
                        { label: '每月', value: 'monthly' },
                      ]}
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    label="最小分红金额"
                    name="minDividendAmount"
                    rules={[{ required: true, message: '请输入' }]}
                    extra="低于此金额不发放"
                  >
                    <InputNumber
                      min={0}
                      precision={2}
                      style={{ width: '100%' }}
                      suffix="USDT"
                    />
                  </Form.Item>
                </Col>
              </Row>
            </Form>
          </Card>
        </Col>

        {/* 邀请返佣配置 */}
        <Col span={12}>
          <Card
            title={
              <Space>
                <TeamOutlined />
                <span>邀请返佣配置</span>
              </Space>
            }
            extra={
              <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={handleSaveReferral}
                loading={saving}
              >
                保存配置
              </Button>
            }
          >
            <Form
              form={referralForm}
              layout="vertical"
            >
              <Form.Item
                label="返佣功能"
                name="enabled"
                valuePropName="checked"
              >
                <Switch checkedChildren="启用" unCheckedChildren="禁用" />
              </Form.Item>

              <Divider />

              <Title level={5}>返佣比例</Title>
              <Alert
                message="返佣来自下级用户产生的燃油费"
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
              />

              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item
                    label="一级返佣（直推）"
                    name="level1Ratio"
                    rules={[{ required: true, message: '请输入' }]}
                    extra="直接邀请的用户"
                  >
                    <InputNumber
                      min={0}
                      max={50}
                      precision={1}
                      style={{ width: '100%' }}
                      suffix="%"
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    label="二级返佣（间推）"
                    name="level2Ratio"
                    rules={[{ required: true, message: '请输入' }]}
                    extra="下级邀请的用户"
                  >
                    <InputNumber
                      min={0}
                      max={30}
                      precision={1}
                      style={{ width: '100%' }}
                      suffix="%"
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    label="三级返佣"
                    name="level3Ratio"
                    extra="三级下线"
                  >
                    <InputNumber
                      min={0}
                      max={20}
                      precision={1}
                      style={{ width: '100%' }}
                      suffix="%"
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Divider />

              <Title level={5}>返佣来源</Title>
              <Form.Item
                label="返佣来源类型"
                name="sourceType"
                rules={[{ required: true, message: '请选择' }]}
              >
                <Select
                  options={[
                    { label: '燃油费（Gas Fee）', value: 'gas_fee' },
                    { label: '订阅费', value: 'subscription' },
                  ]}
                />
              </Form.Item>
            </Form>
          </Card>
        </Col>
      </Row>
      </Spin>

      {/* 配置变更历史 */}
      <Card title="配置变更记录" style={{ marginTop: 24 }}>
        <Table
          dataSource={configHistory}
          columns={[
            { title: '时间', dataIndex: 'time', key: 'time', width: 180,
              render: (v: string) => v ? new Date(v).toLocaleString('zh-CN') : '-',
            },
            {
              title: '类型',
              dataIndex: 'type',
              key: 'type',
              width: 120,
              render: (type: string) => (
                <Tag color={type === '质押分红' ? 'purple' : 'blue'}>{type}</Tag>
              ),
            },
            { title: '变更内容', dataIndex: 'change', key: 'change' },
            { title: '操作人', dataIndex: 'operator', key: 'operator', width: 120 },
          ]}
          rowKey="id"
          pagination={false}
          size="small"
          locale={{ emptyText: '暂无配置变更记录' }}
        />
      </Card>
    </div>
  );
};
