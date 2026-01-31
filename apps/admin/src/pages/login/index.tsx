/**
 * 管理后台登录页面
 */
import { useState, useEffect } from 'react';
import { Form, Input, Button, Card, Typography, message, Space, Checkbox, Divider } from 'antd';
import { UserOutlined, LockOutlined, SafetyOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const { Title, Text } = Typography;

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4001/api';

interface LoginFormData {
  username: string;
  password: string;
  remember?: boolean;
  totpCode?: string;
}

const REMEMBER_KEY = 'admin_remember';

export const LoginPage = () => {
  const [loading, setLoading] = useState(false);
  const [requireTotp, _setRequireTotp] = useState(false); // TODO: 启用 TOTP 后使用
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const { login } = useAuth();

  useEffect(() => {
    const saved = localStorage.getItem(REMEMBER_KEY);
    if (saved) {
      try {
        const { username } = JSON.parse(saved);
        form.setFieldsValue({ username, remember: true });
      } catch {}
    }
  }, [form]);

  const onFinish = async (values: LoginFormData) => {
    setLoading(true);

    try {
      // 调用真实登录 API
      const response = await fetch(`${API_URL}/admin/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: values.username,
          password: values.password,
        }),
      });

      const result = await response.json();

      if (!response.ok || result.code !== 0) {
        throw new Error(result.message || '登录失败');
      }

      // 后端返回格式: { code, message, data: { token, admin } }
      const { token, admin } = result.data;

      // 保存记住账号
      if (values.remember) {
        localStorage.setItem(REMEMBER_KEY, JSON.stringify({ username: values.username }));
      } else {
        localStorage.removeItem(REMEMBER_KEY);
      }

      // 登录成功
      const user = {
        username: admin.username,
        nickname: admin.nickname,
        role: admin.role,
        loginTime: new Date().toISOString(),
      };

      login(token, user);
      message.success('登录成功');
      navigate('/', { replace: true });
    } catch (error: any) {
      message.error(error.message || '登录失败，请检查网络连接');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%)',
      }}
    >
      <Card
        style={{
          width: 400,
          background: '#141414',
          border: '1px solid #303030',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Space align="center">
            <img
              src="/logo.png"
              alt="HOOT"
              style={{ width: 48, height: 48, borderRadius: 8 }}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
            <Title level={2} style={{ margin: 0, color: '#06B6D4' }}>
              HOOT Admin
            </Title>
          </Space>
        </div>

        <Form
          form={form}
          name="login"
          onFinish={onFinish}
          autoComplete="off"
          size="large"
          layout="vertical"
        >
          <Form.Item
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input
              prefix={<UserOutlined style={{ color: '#666' }} />}
              placeholder="用户名"
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: '#666' }} />}
              placeholder="密码"
            />
          </Form.Item>

          {requireTotp && (
            <>
              <Divider style={{ margin: '16px 0', borderColor: '#303030' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>动态令牌验证</Text>
              </Divider>
              <Form.Item
                name="totpCode"
                rules={[{ required: true, message: '请输入动态验证码' }]}
              >
                <Input
                  prefix={<SafetyOutlined style={{ color: '#666' }} />}
                  placeholder="6位动态验证码"
                  maxLength={6}
                />
              </Form.Item>
            </>
          )}

          <Form.Item name="remember" valuePropName="checked" style={{ marginBottom: 16 }}>
            <Checkbox>记住账号</Checkbox>
          </Form.Item>

          <Form.Item style={{ marginBottom: 16 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              style={{
                background: '#06B6D4',
                borderColor: '#06B6D4',
                height: 48,
              }}
            >
              登录
            </Button>
          </Form.Item>
        </Form>

        <div style={{ textAlign: 'center' }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            默认账户: admin / admin123
          </Text>
        </div>
      </Card>
    </div>
  );
};
