/**
 * 安全设置页面
 * 支持两步验证绑定/解绑
 */
import {
  Card,
  Row,
  Col,
  Typography,
  Form,
  Switch,
  Input,
  InputNumber,
  Button,
  Table,
  Space,
  Alert,
  Modal,
  Steps,
  Spin,
  Tag,
  Descriptions,
  Divider,
} from 'antd';
import {
  SafetyOutlined,
  LockOutlined,
  GlobalOutlined,
  KeyOutlined,
  DeleteOutlined,
  PlusOutlined,
  CheckCircleOutlined,
  MobileOutlined,
  QrcodeOutlined,
  CopyOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useMessage } from '../../hooks';

const { Title, Text, Paragraph } = Typography;

import { API_URL } from '../../lib/config';

interface IIPWhitelist {
  id: string;
  ip: string;
  description: string;
  addedAt: string;
}

interface ISecurityStatus {
  totpEnabled: boolean;
  lastLoginAt: string | null;
  lastLoginIp: string | null;
  recentLogins: Array<{
    ipAddress: string | null;
    userAgent: string | null;
    createdAt: string;
  }>;
}

interface ITotpSetup {
  secret: string;
  qrCode: string;
  message: string;
}

const mockIPWhitelist: IIPWhitelist[] = [
  { id: '1', ip: '192.168.1.0/24', description: '办公室内网', addedAt: '2025-01-15' },
  { id: '2', ip: '10.0.0.1', description: '服务器', addedAt: '2025-01-10' },
];

export const SecuritySettingsPage = () => {
  const message = useMessage();
  const { token } = useAuth();
  const [ipWhitelist, setIPWhitelist] = useState(mockIPWhitelist);
  const [newIP, setNewIP] = useState('');
  const [newIPDesc, setNewIPDesc] = useState('');
  const [generalForm] = Form.useForm();
  const [passwordForm] = Form.useForm();

  // TOTP 相关状态
  const [securityStatus, setSecurityStatus] = useState<ISecurityStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [totpModalVisible, setTotpModalVisible] = useState(false);
  const [totpSetup, setTotpSetup] = useState<ITotpSetup | null>(null);
  const [totpStep, setTotpStep] = useState(0);
  const [totpCode, setTotpCode] = useState('');
  const [totpLoading, setTotpLoading] = useState(false);
  const [disableModalVisible, setDisableModalVisible] = useState(false);
  const [disableForm] = Form.useForm();

  // 加载安全状态
  const loadSecurityStatus = async () => {
    try {
      setStatusLoading(true);
      const response = await fetch(`${API_URL}/admin/auth/security`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json();
      if (result.code === 0) {
        setSecurityStatus(result.data);
      }
    } catch (error) {
      console.error('加载安全状态失败:', error);
    } finally {
      setStatusLoading(false);
    }
  };

  useEffect(() => {
    loadSecurityStatus();
  }, [token]);

  // 生成 TOTP 密钥
  const handleGenerateTotp = async () => {
    try {
      setTotpLoading(true);
      const response = await fetch(`${API_URL}/admin/auth/totp/generate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const result = await response.json();
      if (result.code === 0) {
        setTotpSetup(result.data);
        setTotpStep(1);
      } else {
        message.error(result.message || '生成失败');
      }
    } catch (error) {
      message.error('生成失败，请检查网络');
    } finally {
      setTotpLoading(false);
    }
  };

  // 启用 TOTP
  const handleEnableTotp = async () => {
    if (totpCode.length !== 6) {
      message.error('请输入6位验证码');
      return;
    }

    try {
      setTotpLoading(true);
      const response = await fetch(`${API_URL}/admin/auth/totp/enable`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ totpCode }),
      });
      const result = await response.json();
      if (result.code === 0) {
        message.success('两步验证已启用');
        setTotpModalVisible(false);
        setTotpStep(0);
        setTotpCode('');
        setTotpSetup(null);
        loadSecurityStatus();
      } else {
        message.error(result.message || '验证失败');
      }
    } catch (error) {
      message.error('操作失败，请检查网络');
    } finally {
      setTotpLoading(false);
    }
  };

  // 禁用 TOTP
  const handleDisableTotp = async (values: { password: string; totpCode: string }) => {
    try {
      setTotpLoading(true);
      const response = await fetch(`${API_URL}/admin/auth/totp/disable`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });
      const result = await response.json();
      if (result.code === 0) {
        message.success('两步验证已禁用');
        setDisableModalVisible(false);
        disableForm.resetFields();
        loadSecurityStatus();
      } else {
        message.error(result.message || '操作失败');
      }
    } catch (error) {
      message.error('操作失败，请检查网络');
    } finally {
      setTotpLoading(false);
    }
  };

  // 复制到剪贴板
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    message.success('已复制到剪贴板');
  };

  const handleAddIP = () => {
    if (!newIP.trim()) {
      message.error('请输入IP地址');
      return;
    }
    const newItem: IIPWhitelist = {
      id: String(ipWhitelist.length + 1),
      ip: newIP,
      description: newIPDesc || '-',
      addedAt: new Date().toISOString().split('T')[0],
    };
    setIPWhitelist([...ipWhitelist, newItem]);
    setNewIP('');
    setNewIPDesc('');
    message.success('IP已添加');
  };

  const ipColumns = [
    {
      title: 'IP地址',
      dataIndex: 'ip',
      key: 'ip',
      render: (ip: string) => <Text code>{ip}</Text>,
    },
    { title: '描述', dataIndex: 'description', key: 'description' },
    { title: '添加时间', dataIndex: 'addedAt', key: 'addedAt' },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: IIPWhitelist) => (
        <Button
          type="link"
          danger
          icon={<DeleteOutlined />}
          onClick={() => {
            setIPWhitelist(ipWhitelist.filter((i) => i.id !== record.id));
            message.success('已删除');
          }}
        >
          删除
        </Button>
      ),
    },
  ];

  const loginColumns = [
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (t: string) => new Date(t).toLocaleString('zh-CN'),
    },
    {
      title: 'IP地址',
      dataIndex: 'ipAddress',
      key: 'ipAddress',
      render: (ip: string | null) => ip || '-',
    },
    {
      title: '设备',
      dataIndex: 'userAgent',
      key: 'userAgent',
      render: (ua: string | null) => {
        if (!ua) return '-';
        if (ua.includes('Chrome')) return 'Chrome';
        if (ua.includes('Firefox')) return 'Firefox';
        if (ua.includes('Safari')) return 'Safari';
        return '其他';
      },
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Title level={4} style={{ marginBottom: 24 }}>
        <SafetyOutlined style={{ marginRight: 8 }} />
        安全设置
      </Title>

      <Row gutter={24}>
        <Col span={12}>
          {/* 两步验证（核心功能） */}
          <Card
            title={
              <Space>
                <MobileOutlined />
                两步验证 (Google Authenticator)
              </Space>
            }
            style={{ marginBottom: 24 }}
            extra={
              statusLoading ? (
                <Spin size="small" />
              ) : securityStatus?.totpEnabled ? (
                <Tag color="success" icon={<CheckCircleOutlined />}>
                  已启用
                </Tag>
              ) : (
                <Tag color="warning">未启用</Tag>
              )
            }
          >
            {statusLoading ? (
              <Spin />
            ) : securityStatus?.totpEnabled ? (
              <>
                <Alert
                  message="两步验证已启用"
                  description="登录时需要输入 Google Authenticator 生成的动态验证码"
                  type="success"
                  showIcon
                  style={{ marginBottom: 16 }}
                />
                <Button
                  danger
                  onClick={() => setDisableModalVisible(true)}
                  icon={<ExclamationCircleOutlined />}
                >
                  禁用两步验证
                </Button>
              </>
            ) : (
              <>
                <Alert
                  message="建议启用两步验证"
                  description="两步验证可以大幅提高账户安全性，防止密码泄露导致的账户被盗"
                  type="warning"
                  showIcon
                  style={{ marginBottom: 16 }}
                />
                <Button
                  type="primary"
                  onClick={() => {
                    setTotpModalVisible(true);
                    handleGenerateTotp();
                  }}
                  icon={<QrcodeOutlined />}
                >
                  启用两步验证
                </Button>
              </>
            )}
          </Card>

          {/* 登录安全 */}
          <Card
            title={
              <Space>
                <LockOutlined />
                登录安全
              </Space>
            }
            style={{ marginBottom: 24 }}
          >
            <Form
              form={generalForm}
              layout="vertical"
              initialValues={{
                loginNotify: true,
                sessionTimeout: 30,
                maxLoginAttempts: 5,
              }}
            >
              <Form.Item
                name="loginNotify"
                label="异地登录通知"
                valuePropName="checked"
                extra="检测到新IP登录时发送通知"
              >
                <Switch checkedChildren="开启" unCheckedChildren="关闭" />
              </Form.Item>
              <Form.Item
                name="sessionTimeout"
                label="会话超时时间 (分钟)"
                extra="超时后自动退出登录"
              >
                <InputNumber min={5} max={480} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item
                name="maxLoginAttempts"
                label="最大登录尝试次数"
                extra="超过后锁定账户15分钟"
              >
                <InputNumber min={3} max={10} style={{ width: '100%' }} />
              </Form.Item>
              <Button
                type="primary"
                onClick={() => {
                  message.success('设置已保存');
                }}
              >
                保存设置
              </Button>
            </Form>
          </Card>

          {/* 密码策略 */}
          <Card
            title={
              <Space>
                <KeyOutlined />
                密码策略
              </Space>
            }
          >
            <Form
              form={passwordForm}
              layout="vertical"
              initialValues={{
                minLength: 8,
                requireUppercase: true,
                requireNumber: true,
                requireSpecial: false,
                expireDays: 90,
              }}
            >
              <Form.Item name="minLength" label="最小密码长度">
                <InputNumber min={6} max={32} style={{ width: '100%' }} />
              </Form.Item>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="requireUppercase"
                    label="必须包含大写字母"
                    valuePropName="checked"
                  >
                    <Switch />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="requireNumber"
                    label="必须包含数字"
                    valuePropName="checked"
                  >
                    <Switch />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="requireSpecial"
                    label="必须包含特殊字符"
                    valuePropName="checked"
                  >
                    <Switch />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="expireDays"
                    label="密码过期天数"
                    extra="0表示永不过期"
                  >
                    <InputNumber min={0} max={365} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
              <Button
                type="primary"
                onClick={() => {
                  message.success('密码策略已保存');
                }}
              >
                保存策略
              </Button>
            </Form>
          </Card>
        </Col>

        <Col span={12}>
          {/* 最近登录记录 */}
          <Card
            title={
              <Space>
                <SafetyOutlined />
                最近登录记录
              </Space>
            }
            style={{ marginBottom: 24 }}
          >
            {statusLoading ? (
              <Spin />
            ) : (
              <>
                <Descriptions column={1} size="small" style={{ marginBottom: 16 }}>
                  <Descriptions.Item label="上次登录时间">
                    {securityStatus?.lastLoginAt
                      ? new Date(securityStatus.lastLoginAt).toLocaleString('zh-CN')
                      : '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="上次登录IP">
                    {securityStatus?.lastLoginIp || '-'}
                  </Descriptions.Item>
                </Descriptions>
                <Divider style={{ margin: '12px 0' }} />
                <Table
                  dataSource={securityStatus?.recentLogins || []}
                  columns={loginColumns}
                  rowKey="createdAt"
                  pagination={false}
                  size="small"
                  scroll={{ x: 500 }}
                />
              </>
            )}
          </Card>

          {/* IP白名单 */}
          <Card
            title={
              <Space>
                <GlobalOutlined />
                IP白名单
              </Space>
            }
            style={{ marginBottom: 24 }}
            extra={
              <Switch
                checkedChildren="启用"
                unCheckedChildren="禁用"
                defaultChecked={false}
              />
            }
          >
            <Alert
              message="启用IP白名单后，只有白名单中的IP才能访问管理后台"
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
            <Space style={{ marginBottom: 16 }}>
              <Input
                placeholder="IP地址或CIDR"
                value={newIP}
                onChange={(e) => setNewIP(e.target.value)}
                style={{ width: 180 }}
              />
              <Input
                placeholder="描述（可选）"
                value={newIPDesc}
                onChange={(e) => setNewIPDesc(e.target.value)}
                style={{ width: 150 }}
              />
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAddIP}>
                添加
              </Button>
            </Space>
            <Table
              dataSource={ipWhitelist}
              columns={ipColumns}
              rowKey="id"
              pagination={false}
              size="small"
              scroll={{ x: 400 }}
            />
          </Card>

          {/* 敏感操作 */}
          <Card
            title={
              <Space>
                <SafetyOutlined />
                敏感操作确认
              </Space>
            }
          >
            <Alert
              message="启用两步验证后，以下敏感操作需要输入验证码确认"
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
            <Form
              layout="vertical"
              initialValues={{
                confirmWithdraw: true,
                confirmFreeze: true,
                confirmDelete: true,
                confirmRiskSwitch: true,
              }}
            >
              <Form.Item
                name="confirmWithdraw"
                label="大额提现审批"
                valuePropName="checked"
                extra="审批提现需要输入验证码"
              >
                <Switch checkedChildren="开启" unCheckedChildren="关闭" />
              </Form.Item>
              <Form.Item
                name="confirmFreeze"
                label="冻结用户"
                valuePropName="checked"
              >
                <Switch checkedChildren="开启" unCheckedChildren="关闭" />
              </Form.Item>
              <Form.Item
                name="confirmDelete"
                label="删除数据"
                valuePropName="checked"
              >
                <Switch checkedChildren="开启" unCheckedChildren="关闭" />
              </Form.Item>
              <Form.Item
                name="confirmRiskSwitch"
                label="紧急开关操作"
                valuePropName="checked"
              >
                <Switch checkedChildren="开启" unCheckedChildren="关闭" />
              </Form.Item>
              <Button
                type="primary"
                onClick={() => {
                  message.success('设置已保存');
                }}
              >
                保存设置
              </Button>
            </Form>
          </Card>
        </Col>
      </Row>

      {/* 启用两步验证弹窗 */}
      <Modal
        title="启用两步验证"
        open={totpModalVisible}
        onCancel={() => {
          setTotpModalVisible(false);
          setTotpStep(0);
          setTotpCode('');
          setTotpSetup(null);
        }}
        footer={null}
        width={500}
      >
        <Steps
          current={totpStep}
          size="small"
          style={{ marginBottom: 24 }}
          items={[
            { title: '下载应用' },
            { title: '扫描二维码' },
            { title: '验证' },
          ]}
        />

        {totpStep === 0 && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <Spin size="large" />
            <Paragraph style={{ marginTop: 16 }}>正在生成密钥...</Paragraph>
          </div>
        )}

        {totpStep === 1 && totpSetup && (
          <>
            <Alert
              message="步骤 1: 下载 Google Authenticator"
              description="在手机应用商店搜索 Google Authenticator 并安装"
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />

            <Alert
              message="步骤 2: 扫描二维码"
              description="打开 Google Authenticator，点击 + 号，选择扫描二维码"
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />

            <div style={{ textAlign: 'center', margin: '24px 0' }}>
              <img
                src={totpSetup.qrCode}
                alt="TOTP QR Code"
                style={{ width: 200, height: 200, border: '1px solid #303030', borderRadius: 8 }}
              />
            </div>

            <Alert
              message="无法扫码？手动输入密钥"
              description={
                <Space>
                  <Text code copyable={{ text: totpSetup.secret }}>
                    {totpSetup.secret}
                  </Text>
                  <Button
                    type="link"
                    icon={<CopyOutlined />}
                    onClick={() => copyToClipboard(totpSetup.secret)}
                    size="small"
                  >
                    复制
                  </Button>
                </Space>
              }
              type="warning"
              showIcon
              style={{ marginBottom: 24 }}
            />

            <Button
              type="primary"
              block
              onClick={() => setTotpStep(2)}
            >
              下一步：输入验证码
            </Button>
          </>
        )}

        {totpStep === 2 && (
          <>
            <Alert
              message="步骤 3: 输入验证码"
              description="打开 Google Authenticator，输入显示的 6 位数字验证码"
              type="info"
              showIcon
              style={{ marginBottom: 24 }}
            />

            <div style={{ textAlign: 'center', margin: '24px 0' }}>
              <Input
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                maxLength={6}
                style={{
                  width: 200,
                  fontSize: 24,
                  textAlign: 'center',
                  letterSpacing: 8,
                }}
              />
            </div>

            <Space style={{ width: '100%' }} direction="vertical">
              <Button
                type="primary"
                block
                onClick={handleEnableTotp}
                loading={totpLoading}
                disabled={totpCode.length !== 6}
              >
                验证并启用
              </Button>
              <Button block onClick={() => setTotpStep(1)}>
                返回上一步
              </Button>
            </Space>
          </>
        )}
      </Modal>

      {/* 禁用两步验证弹窗 */}
      <Modal
        title="禁用两步验证"
        open={disableModalVisible}
        onCancel={() => {
          setDisableModalVisible(false);
          disableForm.resetFields();
        }}
        footer={null}
        width={400}
      >
        <Alert
          message="警告：禁用两步验证将降低账户安全性"
          type="warning"
          showIcon
          style={{ marginBottom: 24 }}
        />

        <Form form={disableForm} layout="vertical" onFinish={handleDisableTotp}>
          <Form.Item
            name="password"
            label="登录密码"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password placeholder="请输入登录密码" />
          </Form.Item>

          <Form.Item
            name="totpCode"
            label="两步验证码"
            rules={[
              { required: true, message: '请输入验证码' },
              { len: 6, message: '验证码必须是6位' },
            ]}
          >
            <Input placeholder="6 位验证码" maxLength={6} />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              type="primary"
              danger
              htmlType="submit"
              loading={totpLoading}
              block
            >
              确认禁用
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
