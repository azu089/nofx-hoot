/**
 * 系统配置页面
 * 网站基础配置、费率设置等
 */
import { useState } from 'react';
import { List } from '@refinedev/antd';
import {
  Card,
  Form,
  Input,
  InputNumber,
  Button,
  Divider,
  Upload,
  Row,
  Col,
  Typography,
  Switch,
  Alert,
} from 'antd';
import {
  SaveOutlined,
  UploadOutlined,
  LinkOutlined,
} from '@ant-design/icons';
import { useMessage } from '../../hooks';
import { api } from '../../lib/api';

const { Text } = Typography;

interface ISystemConfig {
  // 基本信息
  siteName: string;
  siteDescription: string;
  contactEmail: string;
  // 社交链接
  twitterUrl: string;
  telegramUrl: string;
  discordUrl: string;
  // 法律文档
  termsUrl: string;
  privacyUrl: string;
  // 费率配置
  minDeposit: number;
  minWithdraw: number;
  withdrawFeeRate: number;
  withdrawFeeFixed: number;
  // 功能开关
  enableRegistration: boolean;
  enableDeposit: boolean;
  enableWithdraw: boolean;
  enableTrading: boolean;
  maintenanceMode: boolean;
}

const defaultConfig: ISystemConfig = {
  siteName: 'HOOT',
  siteDescription: 'AI 驱动的量化交易平台',
  contactEmail: 'support@hoot.com',
  twitterUrl: 'https://twitter.com/hoot',
  telegramUrl: 'https://t.me/hoot',
  discordUrl: 'https://discord.gg/hoot',
  termsUrl: '/terms',
  privacyUrl: '/privacy',
  minDeposit: 10,
  minWithdraw: 20,
  withdrawFeeRate: 0.1,
  withdrawFeeFixed: 2,
  enableRegistration: true,
  enableDeposit: true,
  enableWithdraw: true,
  enableTrading: true,
  maintenanceMode: false,
};

export const SystemConfigPage = () => {
  const message = useMessage();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      await api.put('/admin/system-config', values);
      message.success('配置已保存');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '保存失败';
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <List
      headerButtons={
        <Button
          type="primary"
          icon={<SaveOutlined />}
          loading={loading}
          onClick={handleSave}
        >
          保存配置
        </Button>
      }
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={defaultConfig}
      >
        <Row gutter={24}>
          <Col span={12}>
            {/* 基本信息 */}
            <Card title="基本信息" style={{ marginBottom: 24 }}>
              <Form.Item
                label="网站名称"
                name="siteName"
                rules={[{ required: true, message: '请输入网站名称' }]}
              >
                <Input placeholder="网站名称" />
              </Form.Item>

              <Form.Item
                label="网站描述"
                name="siteDescription"
              >
                <Input.TextArea rows={2} placeholder="网站描述" />
              </Form.Item>

              <Form.Item label="网站 Logo">
                <Upload
                  maxCount={1}
                  listType="picture-card"
                  showUploadList={false}
                >
                  <div>
                    <UploadOutlined />
                    <div style={{ marginTop: 8 }}>上传</div>
                  </div>
                </Upload>
              </Form.Item>

              <Form.Item
                label="客服邮箱"
                name="contactEmail"
                rules={[
                  { required: true, message: '请输入客服邮箱' },
                  { type: 'email', message: '请输入有效的邮箱地址' },
                ]}
              >
                <Input placeholder="support@example.com" />
              </Form.Item>
            </Card>

            {/* 社交链接 */}
            <Card title="社交链接" style={{ marginBottom: 24 }}>
              <Form.Item label="Twitter" name="twitterUrl">
                <Input prefix={<LinkOutlined />} placeholder="https://twitter.com/..." />
              </Form.Item>

              <Form.Item label="Telegram" name="telegramUrl">
                <Input prefix={<LinkOutlined />} placeholder="https://t.me/..." />
              </Form.Item>

              <Form.Item label="Discord" name="discordUrl">
                <Input prefix={<LinkOutlined />} placeholder="https://discord.gg/..." />
              </Form.Item>
            </Card>

            {/* 法律文档 */}
            <Card title="法律文档">
              <Form.Item label="服务条款链接" name="termsUrl">
                <Input placeholder="/terms 或完整 URL" />
              </Form.Item>

              <Form.Item label="隐私政策链接" name="privacyUrl">
                <Input placeholder="/privacy 或完整 URL" />
              </Form.Item>
            </Card>
          </Col>

          <Col span={12}>
            {/* 费率配置 */}
            <Card title="费率配置" style={{ marginBottom: 24 }}>
              <Form.Item
                label="最低充值金额 (USDT)"
                name="minDeposit"
                rules={[{ required: true, message: '请输入最低充值金额' }]}
              >
                <InputNumber
                  min={0}
                  precision={2}
                  style={{ width: '100%' }}
                  suffix="USDT"
                />
              </Form.Item>

              <Form.Item
                label="最低提现金额 (USDT)"
                name="minWithdraw"
                rules={[{ required: true, message: '请输入最低提现金额' }]}
              >
                <InputNumber
                  min={0}
                  precision={2}
                  style={{ width: '100%' }}
                  suffix="USDT"
                />
              </Form.Item>

              <Form.Item
                label="提现手续费率 (%)"
                name="withdrawFeeRate"
                rules={[{ required: true, message: '请输入提现手续费率' }]}
              >
                <InputNumber
                  min={0}
                  max={100}
                  precision={2}
                  style={{ width: '100%' }}
                  suffix="%"
                />
              </Form.Item>

              <Form.Item
                label="提现固定手续费 (USDT)"
                name="withdrawFeeFixed"
                rules={[{ required: true, message: '请输入固定手续费' }]}
              >
                <InputNumber
                  min={0}
                  precision={2}
                  style={{ width: '100%' }}
                  suffix="USDT"
                />
              </Form.Item>

              <Alert
                message="提现手续费 = 提现金额 × 费率 + 固定费用"
                type="info"
                showIcon
              />
            </Card>

            {/* 功能开关 */}
            <Card title="功能开关">
              <Form.Item
                label="开放注册"
                name="enableRegistration"
                valuePropName="checked"
              >
                <Switch checkedChildren="开" unCheckedChildren="关" />
              </Form.Item>

              <Form.Item
                label="开放充值"
                name="enableDeposit"
                valuePropName="checked"
              >
                <Switch checkedChildren="开" unCheckedChildren="关" />
              </Form.Item>

              <Form.Item
                label="开放提现"
                name="enableWithdraw"
                valuePropName="checked"
              >
                <Switch checkedChildren="开" unCheckedChildren="关" />
              </Form.Item>

              <Form.Item
                label="开放交易"
                name="enableTrading"
                valuePropName="checked"
              >
                <Switch checkedChildren="开" unCheckedChildren="关" />
              </Form.Item>

              <Divider />

              <Form.Item
                label={
                  <Text type="danger" strong>
                    维护模式
                  </Text>
                }
                name="maintenanceMode"
                valuePropName="checked"
                extra="开启后，前端将显示维护页面，用户无法访问"
              >
                <Switch
                  checkedChildren="维护中"
                  unCheckedChildren="正常"
                  style={{ backgroundColor: form.getFieldValue('maintenanceMode') ? '#f5222d' : undefined }}
                />
              </Form.Item>
            </Card>
          </Col>
        </Row>
      </Form>
    </List>
  );
};
