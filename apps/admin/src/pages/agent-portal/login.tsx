/**
 * 代理商登录页面
 * 独立入口 /agent/login
 */
import { useState } from 'react';
import { Form, Input, Button, Card, Typography } from 'antd';
import { UserOutlined, LockOutlined, CrownOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

import { useMessage } from '../../hooks';

const { Title, Text } = Typography;

import { API_URL as API_BASE } from '../../lib/config';

export default function AgentLogin() {
  const message = useMessage();
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (values: { email: string; password: string }) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/agent/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      const result = await response.json();

      if (!response.ok || result.code !== 0) {
        throw new Error(result.message || '登录失败');
      }

      // 存储 token 和代理商信息
      const { token, agent } = result.data;
      localStorage.setItem('agent_token', token);
      localStorage.setItem('agent_info', JSON.stringify(agent));

      message.success(`欢迎回来，${agent.name}！`);
      navigate('/agent/dashboard');
    } catch (error: any) {
      message.error(error.message || '登录失败，请检查邮箱和密码');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
      }}
    >
      <Card
        style={{
          width: 400,
          borderRadius: 12,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <CrownOutlined style={{ fontSize: 48, color: '#faad14' }} />
          <Title level={3} style={{ marginTop: 16, marginBottom: 8 }}>
            HOOT 代理商后台
          </Title>
          <Text type="secondary">管理您的团队和佣金</Text>
        </div>

        <Form onFinish={handleLogin} layout="vertical" size="large">
          <Form.Item
            name="email"
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '邮箱格式不正确' },
            ]}
          >
            <Input prefix={<UserOutlined />} placeholder="代理商邮箱" />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="登录密码" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              登 录
            </Button>
          </Form.Item>
        </Form>

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            如需开通代理商账号，请联系管理员
          </Text>
        </div>
      </Card>
    </div>
  );
}
