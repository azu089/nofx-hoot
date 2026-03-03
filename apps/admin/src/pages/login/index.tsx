/**
 * 管理后台登录页面
 * 支持两步验证 (Google Authenticator)
 */
import { useState, useEffect } from 'react';
import { Form, Input, Button, Card, Typography, Space, Checkbox, Divider, Alert } from 'antd';
import { UserOutlined, LockOutlined, SafetyOutlined, LockFilled } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useMessage } from '../../hooks';

const { Title, Text } = Typography;

import { API_URL } from '../../lib/config';

interface LoginFormData {
  username: string;
  password: string;
  remember?: boolean;
  totpCode?: string;
}

const REMEMBER_KEY = 'admin_remember';

export const LoginPage = () => {
  const message = useMessage();
  const [loading, setLoading] = useState(false);
  const [requireTotp, setRequireTotp] = useState(false);
  const [accountLocked, setAccountLocked] = useState<string | null>(null);
  const [logoError, setLogoError] = useState(false);
  // 第一步凭据暂存，用于第二步带上
  const [savedCredentials, setSavedCredentials] = useState<{ username: string; password: string } | null>(null);
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
    setAccountLocked(null);

    try {
      const response = await fetch(`${API_URL}/admin/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: savedCredentials?.username ?? values.username,
          password: savedCredentials?.password ?? values.password,
          totpCode: values.totpCode,
        }),
      });

      const result = await response.json();

      // 处理账号锁定
      if (response.status === 403) {
        setAccountLocked(result.message || '账号已锁定');
        return;
      }

      if (!response.ok || result.code !== 0) {
        throw new Error(result.message || '登录失败');
      }

      const data = result.data;

      // 检查是否需要两步验证
      if (data.requireTotp) {
        // 保存第一步凭据，供第二步提交时使用
        setSavedCredentials({ username: values.username, password: values.password });
        setRequireTotp(true);
        message.info('请输入 Google Authenticator 验证码');
        return;
      }

      // 登录成功
      const { token, admin } = data;

      // 保存记住账号
      if (values.remember) {
        localStorage.setItem(REMEMBER_KEY, JSON.stringify({ username: values.username }));
      } else {
        localStorage.removeItem(REMEMBER_KEY);
      }

      const user = {
        username: admin.username,
        nickname: admin.nickname,
        role: admin.role,
        totpEnabled: admin.totpEnabled,
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

  // 重置两步验证状态
  const handleBack = () => {
    setRequireTotp(false);
    setSavedCredentials(null);
    form.setFieldValue('totpCode', undefined);
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
          width: 420,
          background: '#141414',
          border: '1px solid #303030',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Space align="center">
            {logoError ? (
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #06B6D4, #0891B2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 20,
                  fontWeight: 'bold',
                  color: '#fff',
                  flexShrink: 0,
                }}
              >
                H
              </div>
            ) : (
              <img
                src="/logo.png"
                alt="HOOT"
                style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }}
                onError={() => setLogoError(true)}
              />
            )}
            <Title level={2} style={{ margin: 0, color: '#06B6D4' }}>
              HOOT Admin
            </Title>
          </Space>
          {requireTotp && (
            <div style={{ marginTop: 8 }}>
              <Text type="secondary" style={{ fontSize: 13 }}>
                <LockFilled style={{ marginRight: 4 }} />
                两步验证
              </Text>
            </div>
          )}
        </div>

        {accountLocked && (
          <Alert
            message="账号已锁定"
            description={accountLocked}
            type="error"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        <Form
          form={form}
          name="login"
          onFinish={onFinish}
          autoComplete="off"
          size="large"
          layout="vertical"
        >
          {!requireTotp ? (
            <>
              {/* 第一步：用户名密码 */}
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

              <Form.Item name="remember" valuePropName="checked" style={{ marginBottom: 16 }}>
                <Checkbox>记住账号</Checkbox>
              </Form.Item>
            </>
          ) : (
            <>
              {/* 第二步：两步验证 */}
              <Alert
                message="两步验证已启用"
                description="请打开 Google Authenticator 应用，输入 6 位动态验证码"
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
              />

              <Form.Item
                name="totpCode"
                rules={[
                  { required: true, message: '请输入验证码' },
                  { len: 6, message: '验证码必须是6位' },
                  { pattern: /^\d+$/, message: '验证码只能是数字' },
                ]}
              >
                <Input
                  prefix={<SafetyOutlined style={{ color: '#06B6D4' }} />}
                  placeholder="6 位动态验证码"
                  maxLength={6}
                  style={{ fontSize: 18, letterSpacing: 8, textAlign: 'center' }}
                  autoFocus
                />
              </Form.Item>

              <div style={{ marginBottom: 16 }}>
                <Button type="link" onClick={handleBack} style={{ padding: 0 }}>
                  ← 返回重新登录
                </Button>
              </div>
            </>
          )}

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
              {requireTotp ? '验证并登录' : '登录'}
            </Button>
          </Form.Item>
        </Form>

        {!requireTotp && (
          <>
            <Divider style={{ margin: '16px 0', borderColor: '#303030' }} />
            <div style={{ textAlign: 'center' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                首次使用请立即修改密码并启用两步验证
              </Text>
            </div>
          </>
        )}
      </Card>
    </div>
  );
};
