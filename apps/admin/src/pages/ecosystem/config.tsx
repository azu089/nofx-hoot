/**
 * 生态配置页面
 * 质押分红比例、邀请返佣配置
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
  message,
  Row,
  Col,
  Statistic,
  Table,
  Tag,
  Switch,
  Select,
} from 'antd';
import {
  SaveOutlined,
  ExclamationCircleOutlined,
  PercentageOutlined,
  TeamOutlined,
  GiftOutlined,
  DollarOutlined,
} from '@ant-design/icons';
import { useState } from 'react';

const { Title } = Typography;

// 质押分红配置
interface IStakingConfig {
  // 收入分配比例
  dividendPoolRatio: number;    // 分红池比例 (40%)
  buybackRatio: number;         // 回购销毁比例 (10%)
  platformRatio: number;        // 平台比例 (50%)

  // 质押类型配置
  typeA: {
    enabled: boolean;
    minAmount: number;          // 最小质押量
    baseMultiplier: number;     // 基础乘数 (固定 1.0x)
  };
  typeB: {
    enabled: boolean;
    minAmount: number;
    minLockDays: number;        // 最小锁定天数
    maxLockDays: number;        // 最大锁定天数
    maxMultiplier: number;      // 最大乘数 (3.0x)
  };

  // 分红执行
  dividendCycle: 'daily' | 'weekly' | 'monthly';
  minDividendAmount: number;    // 最小分红金额
}

// 邀请返佣配置
interface IReferralConfig {
  enabled: boolean;

  // 返佣比例
  level1Ratio: number;          // 一级返佣 (直推) 10%
  level2Ratio: number;          // 二级返佣 (间推) 5%

  // 返佣来源
  sourceType: 'gas_fee' | 'profit' | 'both';

  // 返佣条件
  minTradeAmount: number;       // 最小交易金额
  minProfitAmount: number;      // 最小盈利金额

  // 返佣上限
  maxDailyCommission: number;   // 每日上限
  maxTotalCommission: number;   // 总上限 (0=无上限)
}

// 模拟当前配置
const mockStakingConfig: IStakingConfig = {
  dividendPoolRatio: 40,
  buybackRatio: 10,
  platformRatio: 50,
  typeA: {
    enabled: true,
    minAmount: 1000,
    baseMultiplier: 1.0,
  },
  typeB: {
    enabled: true,
    minAmount: 10000,
    minLockDays: 30,
    maxLockDays: 365,
    maxMultiplier: 3.0,
  },
  dividendCycle: 'weekly',
  minDividendAmount: 1,
};

const mockReferralConfig: IReferralConfig = {
  enabled: true,
  level1Ratio: 10,
  level2Ratio: 5,
  sourceType: 'gas_fee',
  minTradeAmount: 100,
  minProfitAmount: 10,
  maxDailyCommission: 1000,
  maxTotalCommission: 0,
};

// 统计数据
const mockStats = {
  totalDividendPaid: 2580000,
  totalCommissionPaid: 156000,
  avgDailyDividend: 12500,
  avgDailyCommission: 2800,
  activeStakers: 892,
  activeReferrers: 156,
};

export const EcosystemConfigPage = () => {
  const [stakingForm] = Form.useForm();
  const [referralForm] = Form.useForm();
  const [loading, setLoading] = useState(false);

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
          setLoading(true);
          // 模拟保存
          await new Promise(resolve => setTimeout(resolve, 1000));
          setLoading(false);
          message.success('质押分红配置已保存');
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
          setLoading(true);
          await new Promise(resolve => setTimeout(resolve, 1000));
          setLoading(false);
          message.success('邀请返佣配置已保存');
        },
      });
    } catch (error) {
      console.error('验证失败:', error);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <Title level={4} style={{ marginBottom: 24 }}>生态配置</Title>

      {/* 统计概览 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="累计分红发放"
              value={mockStats.totalDividendPaid}
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
              value={mockStats.totalCommissionPaid}
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
              value={mockStats.activeStakers}
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
              value={mockStats.activeReferrers}
              prefix={<TeamOutlined />}
              suffix="人"
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

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
                loading={loading}
              >
                保存配置
              </Button>
            }
          >
            <Form
              form={stakingForm}
              layout="vertical"
              initialValues={mockStakingConfig}
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
                      addonAfter="%"
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
                      addonAfter="%"
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
                      addonAfter="%"
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Divider />

              <Title level={5}>A类质押（活期）</Title>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item
                    label="启用状态"
                    name={['typeA', 'enabled']}
                    valuePropName="checked"
                  >
                    <Switch checkedChildren="启用" unCheckedChildren="禁用" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    label="最小质押量"
                    name={['typeA', 'minAmount']}
                    rules={[{ required: true, message: '请输入' }]}
                  >
                    <InputNumber
                      min={0}
                      style={{ width: '100%' }}
                      addonAfter="HOOT"
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    label="基础乘数"
                    name={['typeA', 'baseMultiplier']}
                  >
                    <InputNumber
                      disabled
                      style={{ width: '100%' }}
                      addonAfter="x"
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Title level={5}>B类质押（定期）</Title>
              <Row gutter={16}>
                <Col span={6}>
                  <Form.Item
                    label="启用状态"
                    name={['typeB', 'enabled']}
                    valuePropName="checked"
                  >
                    <Switch checkedChildren="启用" unCheckedChildren="禁用" />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item
                    label="最小质押量"
                    name={['typeB', 'minAmount']}
                    rules={[{ required: true, message: '请输入' }]}
                  >
                    <InputNumber
                      min={0}
                      style={{ width: '100%' }}
                      addonAfter="HOOT"
                    />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item
                    label="最小锁定天数"
                    name={['typeB', 'minLockDays']}
                    rules={[{ required: true, message: '请输入' }]}
                  >
                    <InputNumber
                      min={1}
                      style={{ width: '100%' }}
                      addonAfter="天"
                    />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item
                    label="最大乘数"
                    name={['typeB', 'maxMultiplier']}
                    rules={[{ required: true, message: '请输入' }]}
                  >
                    <InputNumber
                      min={1}
                      max={10}
                      precision={1}
                      style={{ width: '100%' }}
                      addonAfter="x"
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
                      addonAfter="USDT"
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
                loading={loading}
              >
                保存配置
              </Button>
            }
          >
            <Form
              form={referralForm}
              layout="vertical"
              initialValues={mockReferralConfig}
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
                <Col span={12}>
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
                      addonAfter="%"
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
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
                      addonAfter="%"
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
                    { label: '盈利分成', value: 'profit' },
                    { label: '燃油费 + 盈利分成', value: 'both' },
                  ]}
                />
              </Form.Item>

              <Divider />

              <Title level={5}>返佣条件</Title>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    label="最小交易金额"
                    name="minTradeAmount"
                    rules={[{ required: true, message: '请输入' }]}
                    extra="交易金额需达到此值"
                  >
                    <InputNumber
                      min={0}
                      precision={2}
                      style={{ width: '100%' }}
                      addonAfter="USDT"
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    label="最小盈利金额"
                    name="minProfitAmount"
                    rules={[{ required: true, message: '请输入' }]}
                    extra="盈利需达到此值（仅盈利类型）"
                  >
                    <InputNumber
                      min={0}
                      precision={2}
                      style={{ width: '100%' }}
                      addonAfter="USDT"
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Divider />

              <Title level={5}>返佣上限</Title>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    label="每日返佣上限"
                    name="maxDailyCommission"
                    rules={[{ required: true, message: '请输入' }]}
                    extra="单人每日最多获得"
                  >
                    <InputNumber
                      min={0}
                      precision={2}
                      style={{ width: '100%' }}
                      addonAfter="USDT"
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    label="总返佣上限"
                    name="maxTotalCommission"
                    rules={[{ required: true, message: '请输入' }]}
                    extra="0 表示无上限"
                  >
                    <InputNumber
                      min={0}
                      precision={2}
                      style={{ width: '100%' }}
                      addonAfter="USDT"
                    />
                  </Form.Item>
                </Col>
              </Row>
            </Form>
          </Card>
        </Col>
      </Row>

      {/* 配置变更历史 */}
      <Card title="配置变更记录" style={{ marginTop: 24 }}>
        <Table
          dataSource={[
            {
              id: '1',
              time: '2025-01-30 10:00:00',
              type: '质押分红',
              change: '分红池比例: 35% → 40%',
              operator: 'admin',
            },
            {
              id: '2',
              time: '2025-01-25 14:30:00',
              type: '邀请返佣',
              change: '一级返佣: 8% → 10%',
              operator: 'super_admin',
            },
            {
              id: '3',
              time: '2025-01-20 09:00:00',
              type: '质押分红',
              change: '分红周期: daily → weekly',
              operator: 'admin',
            },
          ]}
          columns={[
            { title: '时间', dataIndex: 'time', key: 'time', width: 180 },
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
        />
      </Card>
    </div>
  );
};
