/**
 * 安全设置页面
 */
import { Card, Row, Col, Typography, Form, Switch, Input, InputNumber, Button, Table, Space, message, Alert } from 'antd';
import { SafetyOutlined, LockOutlined, GlobalOutlined, KeyOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { useState } from 'react';

const { Title, Text } = Typography;

interface IIPWhitelist {
  id: string;
  ip: string;
  description: string;
  addedAt: string;
}

const mockIPWhitelist: IIPWhitelist[] = [
  { id: '1', ip: '192.168.1.0/24', description: '办公室内网', addedAt: '2025-01-15' },
  { id: '2', ip: '10.0.0.1', description: '服务器', addedAt: '2025-01-10' },
];

export const SecuritySettingsPage = () => {
  const [ipWhitelist, setIPWhitelist] = useState(mockIPWhitelist);
  const [newIP, setNewIP] = useState('');
  const [newIPDesc, setNewIPDesc] = useState('');
  const [generalForm] = Form.useForm();
  const [passwordForm] = Form.useForm();

  const handleAddIP = () => {
    if (!newIP.trim()) { message.error('请输入IP地址'); return; }
    const newItem: IIPWhitelist = {
      id: String(ipWhitelist.length + 1),
      ip: newIP,
      description: newIPDesc || '-',
      addedAt: new Date().toISOString().split('T')[0],
    };
    setIPWhitelist([...ipWhitelist, newItem]);
    setNewIP(''); setNewIPDesc('');
    message.success('IP已添加');
  };

  const ipColumns = [
    { title: 'IP地址', dataIndex: 'ip', key: 'ip', render: (ip: string) => <Text code>{ip}</Text> },
    { title: '描述', dataIndex: 'description', key: 'description' },
    { title: '添加时间', dataIndex: 'addedAt', key: 'addedAt' },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: IIPWhitelist) => (
        <Button type="link" danger icon={<DeleteOutlined />} onClick={() => { setIPWhitelist(ipWhitelist.filter(i => i.id !== record.id)); message.success('已删除'); }}>
          删除
        </Button>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Title level={4} style={{ marginBottom: 24 }}>安全设置</Title>
      <Row gutter={24}>
        <Col span={12}>
          {/* 登录安全 */}
          <Card title={<Space><LockOutlined />登录安全</Space>} style={{ marginBottom: 24 }}>
            <Form form={generalForm} layout="vertical" initialValues={{ twoFactor: false, loginNotify: true, sessionTimeout: 30, maxLoginAttempts: 5 }}>
              <Form.Item name="twoFactor" label="双因素认证 (2FA)" valuePropName="checked">
                <Switch checkedChildren="开启" unCheckedChildren="关闭" />
              </Form.Item>
              <Form.Item name="loginNotify" label="登录通知" valuePropName="checked" extra="有新登录时发送邮件通知">
                <Switch checkedChildren="开启" unCheckedChildren="关闭" />
              </Form.Item>
              <Form.Item name="sessionTimeout" label="会话超时时间 (分钟)" extra="超时后自动退出登录">
                <InputNumber min={5} max={480} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="maxLoginAttempts" label="最大登录尝试次数" extra="超过后锁定账户15分钟">
                <InputNumber min={3} max={10} style={{ width: '100%' }} />
              </Form.Item>
              <Button type="primary" onClick={() => { message.success('设置已保存'); }}>保存设置</Button>
            </Form>
          </Card>

          {/* 密码策略 */}
          <Card title={<Space><KeyOutlined />密码策略</Space>}>
            <Form form={passwordForm} layout="vertical" initialValues={{ minLength: 8, requireUppercase: true, requireNumber: true, requireSpecial: false, expireDays: 90 }}>
              <Form.Item name="minLength" label="最小密码长度">
                <InputNumber min={6} max={32} style={{ width: '100%' }} />
              </Form.Item>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="requireUppercase" label="必须包含大写字母" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="requireNumber" label="必须包含数字" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="requireSpecial" label="必须包含特殊字符" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="expireDays" label="密码过期天数" extra="0表示永不过期">
                    <InputNumber min={0} max={365} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
              <Button type="primary" onClick={() => { message.success('密码策略已保存'); }}>保存策略</Button>
            </Form>
          </Card>
        </Col>

        <Col span={12}>
          {/* IP白名单 */}
          <Card title={<Space><GlobalOutlined />IP白名单</Space>} style={{ marginBottom: 24 }} extra={<Switch checkedChildren="启用" unCheckedChildren="禁用" defaultChecked />}>
            <Alert message="启用IP白名单后，只有白名单中的IP才能访问管理后台" type="info" showIcon style={{ marginBottom: 16 }} />
            <Space style={{ marginBottom: 16 }}>
              <Input placeholder="IP地址或CIDR" value={newIP} onChange={(e) => setNewIP(e.target.value)} style={{ width: 180 }} />
              <Input placeholder="描述（可选）" value={newIPDesc} onChange={(e) => setNewIPDesc(e.target.value)} style={{ width: 150 }} />
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAddIP}>添加</Button>
            </Space>
            <Table dataSource={ipWhitelist} columns={ipColumns} rowKey="id" pagination={false} size="small" />
          </Card>

          {/* 敏感操作 */}
          <Card title={<Space><SafetyOutlined />敏感操作确认</Space>}>
            <Form layout="vertical" initialValues={{ confirmWithdraw: true, confirmFreeze: true, confirmDelete: true, confirmRiskSwitch: true }}>
              <Form.Item name="confirmWithdraw" label="大额提现二次确认" valuePropName="checked" extra="提现金额超过1000 USDT时需要二次确认">
                <Switch checkedChildren="开启" unCheckedChildren="关闭" />
              </Form.Item>
              <Form.Item name="confirmFreeze" label="冻结用户二次确认" valuePropName="checked">
                <Switch checkedChildren="开启" unCheckedChildren="关闭" />
              </Form.Item>
              <Form.Item name="confirmDelete" label="删除数据二次确认" valuePropName="checked">
                <Switch checkedChildren="开启" unCheckedChildren="关闭" />
              </Form.Item>
              <Form.Item name="confirmRiskSwitch" label="紧急开关二次确认" valuePropName="checked">
                <Switch checkedChildren="开启" unCheckedChildren="关闭" />
              </Form.Item>
              <Button type="primary" onClick={() => { message.success('设置已保存'); }}>保存设置</Button>
            </Form>
          </Card>
        </Col>
      </Row>
    </div>
  );
};
