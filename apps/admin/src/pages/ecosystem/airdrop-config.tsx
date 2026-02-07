/**
 * 签到领币配置页面
 * 管理空投奖励、上限、释放参数
 * API:
 * - GET /admin/config/airdrop_rewards
 * - PUT /admin/config/airdrop_rewards
 * - GET /admin/config/airdrop_caps
 * - PUT /admin/config/airdrop_caps
 * - GET /admin/config/vesting_config
 * - PUT /admin/config/vesting_config
 * - GET /admin/config-history
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
  Table,
  Tag,
  Spin,
} from 'antd';
import {
  SaveOutlined,
  ExclamationCircleOutlined,
  GiftOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useState, useEffect, useCallback } from 'react';
import { api } from '../../lib/api';
import { useMessage } from '../../hooks';

const { Title } = Typography;

// 奖励配置
interface IAirdropRewards {
  register: number;
  bind_tg: number;
  bind_wallet: number;
  bind_email: number;
  referral: number;
  trading_profit: number;
  checkin: {
    base: number;
    max: number;
    increment: number;
  };
}

// 上限配置
interface IAirdropCaps {
  checkinDailyCap: number;
  checkinLifetimeCap: number;
  tradingProfitDailyCap: number;
  tradingProfitLifetimeCap: number;
  referralDailyCap: number;
  referralLifetimeCap: number;
}

// 释放配置
interface IVestingConfig {
  defaultDays: number;
  minDays: number;
  minWithdrawAmount: number;
  withdrawFeeRate: number;
}

// 配置变更历史
interface IConfigHistory {
  id: string;
  key: string;
  description: string;
  details: {
    oldValue: unknown;
    newValue: unknown;
  };
  admin: {
    nickname: string;
  };
  createdAt: string;
}

// 默认配置
const DEFAULT_REWARDS: IAirdropRewards = {
  register: 50,
  bind_tg: 10,
  bind_wallet: 10,
  bind_email: 15,
  referral: 25,
  trading_profit: 3,
  checkin: { base: 5, max: 20, increment: 1 },
};

const DEFAULT_CAPS: IAirdropCaps = {
  checkinDailyCap: 20,
  checkinLifetimeCap: 5000,
  tradingProfitDailyCap: 1000,
  tradingProfitLifetimeCap: 100000,
  referralDailyCap: 500,
  referralLifetimeCap: 50000,
};

const DEFAULT_VESTING: IVestingConfig = {
  defaultDays: 90,
  minDays: 30,
  minWithdrawAmount: 100,
  withdrawFeeRate: 0.05,
};

export const AirdropConfigPage = () => {
  const message = useMessage();
  const [rewardsForm] = Form.useForm();
  const [capsForm] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [configHistory, setConfigHistory] = useState<IConfigHistory[]>([]);

  // 加载配置数据
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [rewardsRes, capsRes, vestingRes, historyRes] = await Promise.all([
        api.get<{ value: IAirdropRewards }>('/admin/config/airdrop_rewards').catch(() => ({ value: DEFAULT_REWARDS })),
        api.get<{ value: IAirdropCaps }>('/admin/config/airdrop_caps').catch(() => ({ value: DEFAULT_CAPS })),
        api.get<{ value: IVestingConfig }>('/admin/config/vesting_config').catch(() => ({ value: DEFAULT_VESTING })),
        api.get<IConfigHistory[]>('/admin/config-history').catch(() => []),
      ]);

      // 设置表单值
      rewardsForm.setFieldsValue(rewardsRes.value || DEFAULT_REWARDS);
      capsForm.setFieldsValue({
        ...(capsRes.value || DEFAULT_CAPS),
        ...(vestingRes.value || DEFAULT_VESTING),
      });

      // 设置配置变更历史（仅显示空投相关）
      const airdropHistory = (historyRes || []).filter(
        (item) =>
          item.key === 'airdrop_rewards' ||
          item.key === 'airdrop_caps' ||
          item.key === 'vesting_config'
      );
      setConfigHistory(airdropHistory);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '加载配置失败';
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [rewardsForm, capsForm, message]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 保存奖励配置
  const handleSaveRewards = async () => {
    try {
      await rewardsForm.validateFields();

      Modal.confirm({
        title: '确认保存奖励金额配置',
        icon: <ExclamationCircleOutlined />,
        content: (
          <div>
            <Alert
              message="重要提示"
              description="修改奖励金额配置将立即生效，新用户将按新配置获得奖励。"
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
            const values = rewardsForm.getFieldsValue();
            await api.put('/admin/config/airdrop_rewards', { value: values });
            message.success('奖励金额配置已保存');
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

  // 保存上限 & 释放配置
  const handleSaveCapsAndVesting = async () => {
    try {
      await capsForm.validateFields();

      Modal.confirm({
        title: '确认保存上限 & 释放配置',
        icon: <ExclamationCircleOutlined />,
        content: (
          <div>
            <Alert
              message="重要提示"
              description="修改上限和释放配置将立即生效，请确保配置合理。"
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
            const values = capsForm.getFieldsValue();

            // 分离上限和释放配置
            const capsData: IAirdropCaps = {
              checkinDailyCap: values.checkinDailyCap,
              checkinLifetimeCap: values.checkinLifetimeCap,
              tradingProfitDailyCap: values.tradingProfitDailyCap,
              tradingProfitLifetimeCap: values.tradingProfitLifetimeCap,
              referralDailyCap: values.referralDailyCap,
              referralLifetimeCap: values.referralLifetimeCap,
            };

            const vestingData: IVestingConfig = {
              defaultDays: values.defaultDays,
              minDays: values.minDays,
              minWithdrawAmount: values.minWithdrawAmount,
              withdrawFeeRate: values.withdrawFeeRate,
            };

            // 并行保存
            await Promise.all([
              api.put('/admin/config/airdrop_caps', { value: capsData }),
              api.put('/admin/config/vesting_config', { value: vestingData }),
            ]);

            message.success('上限 & 释放配置已保存');
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
        <Title level={4} style={{ margin: 0 }}>签到领币配置</Title>
        <Button
          icon={<ReloadOutlined spin={loading} />}
          onClick={fetchData}
        >
          刷新
        </Button>
      </div>

      <Row gutter={24}>
        {/* 奖励金额配置 */}
        <Col span={12}>
          <Card
            title={
              <Space>
                <GiftOutlined />
                <span>奖励金额配置</span>
              </Space>
            }
            extra={
              <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={handleSaveRewards}
                loading={saving}
              >
                保存配置
              </Button>
            }
          >
            <Form
              form={rewardsForm}
              layout="vertical"
            >
              <Form.Item
                label="注册奖励"
                name="register"
                rules={[{ required: true, message: '请输入' }]}
              >
                <InputNumber
                  min={0}
                  precision={0}
                  style={{ width: '100%' }}
                  suffix="HOOT"
                />
              </Form.Item>

              <Form.Item
                label="绑定TG奖励"
                name="bind_tg"
                rules={[{ required: true, message: '请输入' }]}
              >
                <InputNumber
                  min={0}
                  precision={0}
                  style={{ width: '100%' }}
                  suffix="HOOT"
                />
              </Form.Item>

              <Form.Item
                label="绑定钱包奖励"
                name="bind_wallet"
                rules={[{ required: true, message: '请输入' }]}
              >
                <InputNumber
                  min={0}
                  precision={0}
                  style={{ width: '100%' }}
                  suffix="HOOT"
                />
              </Form.Item>

              <Form.Item
                label="绑定邮箱奖励"
                name="bind_email"
                rules={[{ required: true, message: '请输入' }]}
              >
                <InputNumber
                  min={0}
                  precision={0}
                  style={{ width: '100%' }}
                  suffix="HOOT"
                />
              </Form.Item>

              <Form.Item
                label="邀请奖励"
                name="referral"
                rules={[{ required: true, message: '请输入' }]}
                extra="每邀请一人奖励"
              >
                <InputNumber
                  min={0}
                  precision={0}
                  style={{ width: '100%' }}
                  suffix="HOOT"
                />
              </Form.Item>

              <Form.Item
                label="交易盈利倍数"
                name="trading_profit"
                rules={[{ required: true, message: '请输入' }]}
                extra="盈利金额 × 倍数 = 奖励HOOT"
              >
                <InputNumber
                  min={0}
                  precision={1}
                  style={{ width: '100%' }}
                  suffix="x"
                />
              </Form.Item>

              <Divider>签到奖励</Divider>

              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item
                    label="签到基础奖励"
                    name={['checkin', 'base']}
                    rules={[{ required: true, message: '请输入' }]}
                  >
                    <InputNumber
                      min={0}
                      precision={0}
                      style={{ width: '100%' }}
                      suffix="HOOT"
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    label="签到最大奖励"
                    name={['checkin', 'max']}
                    rules={[{ required: true, message: '请输入' }]}
                  >
                    <InputNumber
                      min={0}
                      precision={0}
                      style={{ width: '100%' }}
                      suffix="HOOT"
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    label="每日递增"
                    name={['checkin', 'increment']}
                    rules={[{ required: true, message: '请输入' }]}
                  >
                    <InputNumber
                      min={0}
                      precision={0}
                      style={{ width: '100%' }}
                      suffix="HOOT"
                    />
                  </Form.Item>
                </Col>
              </Row>
            </Form>
          </Card>
        </Col>

        {/* 上限 & 释放配置 */}
        <Col span={12}>
          <Card
            title="上限 & 释放配置"
            extra={
              <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={handleSaveCapsAndVesting}
                loading={saving}
              >
                保存配置
              </Button>
            }
          >
            <Form
              form={capsForm}
              layout="vertical"
            >
              <Divider>签到上限</Divider>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    label="每日上限"
                    name="checkinDailyCap"
                    rules={[{ required: true, message: '请输入' }]}
                  >
                    <InputNumber
                      min={0}
                      precision={0}
                      style={{ width: '100%' }}
                      suffix="HOOT"
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    label="终身上限"
                    name="checkinLifetimeCap"
                    rules={[{ required: true, message: '请输入' }]}
                  >
                    <InputNumber
                      min={0}
                      precision={0}
                      style={{ width: '100%' }}
                      suffix="HOOT"
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Divider>交易上限</Divider>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    label="交易每日上限"
                    name="tradingProfitDailyCap"
                    rules={[{ required: true, message: '请输入' }]}
                  >
                    <InputNumber
                      min={0}
                      precision={0}
                      style={{ width: '100%' }}
                      suffix="HOOT"
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    label="交易终身上限"
                    name="tradingProfitLifetimeCap"
                    rules={[{ required: true, message: '请输入' }]}
                  >
                    <InputNumber
                      min={0}
                      precision={0}
                      style={{ width: '100%' }}
                      suffix="HOOT"
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Divider>邀请上限</Divider>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    label="邀请每日上限"
                    name="referralDailyCap"
                    rules={[{ required: true, message: '请输入' }]}
                  >
                    <InputNumber
                      min={0}
                      precision={0}
                      style={{ width: '100%' }}
                      suffix="HOOT"
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    label="邀请终身上限"
                    name="referralLifetimeCap"
                    rules={[{ required: true, message: '请输入' }]}
                  >
                    <InputNumber
                      min={0}
                      precision={0}
                      style={{ width: '100%' }}
                      suffix="HOOT"
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Divider>释放参数</Divider>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    label="默认释放天数"
                    name="defaultDays"
                    rules={[{ required: true, message: '请输入' }]}
                  >
                    <InputNumber
                      min={1}
                      precision={0}
                      style={{ width: '100%' }}
                      suffix="天"
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    label="最小释放天数"
                    name="minDays"
                    rules={[{ required: true, message: '请输入' }]}
                  >
                    <InputNumber
                      min={1}
                      precision={0}
                      style={{ width: '100%' }}
                      suffix="天"
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    label="最低提现额"
                    name="minWithdrawAmount"
                    rules={[{ required: true, message: '请输入' }]}
                  >
                    <InputNumber
                      min={0}
                      precision={0}
                      style={{ width: '100%' }}
                      suffix="HOOT"
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    label="提现手续费"
                    name="withdrawFeeRate"
                    rules={[{ required: true, message: '请输入' }]}
                    extra="0.05 = 5%"
                  >
                    <InputNumber
                      min={0}
                      max={1}
                      precision={2}
                      step={0.01}
                      style={{ width: '100%' }}
                      suffix="%"
                      formatter={(value) => `${(parseFloat(String(value ?? 0)) * 100).toFixed(0)}`}
                      parser={(value) => parseFloat(String(value ?? 0)) / 100 as unknown as 0}
                    />
                  </Form.Item>
                </Col>
              </Row>
            </Form>
          </Card>
        </Col>
      </Row>

      {/* 配置变更历史 */}
      <Card title="配置变更历史" style={{ marginTop: 24 }}>
        <Table
          dataSource={configHistory}
          columns={[
            {
              title: '时间',
              dataIndex: 'createdAt',
              key: 'createdAt',
              width: 180,
              render: (v: string) => v ? new Date(v).toLocaleString('zh-CN') : '-',
            },
            {
              title: '配置项',
              dataIndex: 'key',
              key: 'key',
              width: 150,
              render: (key: string) => {
                const colorMap: Record<string, string> = {
                  airdrop_rewards: 'blue',
                  airdrop_caps: 'orange',
                  vesting_config: 'purple',
                };
                const labelMap: Record<string, string> = {
                  airdrop_rewards: '奖励金额',
                  airdrop_caps: '上限配置',
                  vesting_config: '释放参数',
                };
                return <Tag color={colorMap[key] || 'default'}>{labelMap[key] || key}</Tag>;
              },
            },
            {
              title: '管理员',
              dataIndex: ['admin', 'nickname'],
              key: 'admin',
              width: 120,
            },
            {
              title: '变更内容',
              dataIndex: 'details',
              key: 'details',
              render: (details: { oldValue: unknown; newValue: unknown }) => {
                if (!details) return '-';
                return (
                  <Space direction="vertical" size={4}>
                    <div>
                      <Tag color="red">旧值</Tag>
                      <code style={{ fontSize: 12 }}>{JSON.stringify(details.oldValue)}</code>
                    </div>
                    <div>
                      <Tag color="green">新值</Tag>
                      <code style={{ fontSize: 12 }}>{JSON.stringify(details.newValue)}</code>
                    </div>
                  </Space>
                );
              },
            },
          ]}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          size="small"
          locale={{ emptyText: '暂无配置变更记录' }}
        />
      </Card>
    </div>
  );
};
