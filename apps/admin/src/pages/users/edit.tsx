/**
 * 用户编辑页面
 * 修改用户信息、调整资产
 * 已对接真实 API:
 * - GET /admin/users/:id
 * - PUT /admin/users/:id
 * - POST /admin/users/:id/adjust-balance
 * - POST /admin/users/:id/reset-password
 */
import { Edit } from '@refinedev/antd';
import {
  Card,
  Form,
  Input,
  Select,
  Button,
  Space,
  Divider,
  InputNumber,
  Radio,
  Typography,
  Alert,
  Spin,
} from 'antd';
import { useMessage, useModal } from '../../hooks';
import {
  SaveOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';

const { Text } = Typography;
const { TextArea } = Input;

interface UserDetail {
  id: string;
  email: string;
  nickname: string | null;
  phone: string | null;
  status: string;
  usdtBalance: string;
  hootBalance: string;
}

export const UserEdit = () => {
  const message = useMessage();
  const modal = useModal();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [assetForm] = Form.useForm();
  const [assetType, setAssetType] = useState<'usdt' | 'hoot'>('usdt');
  const [adjustType, setAdjustType] = useState<'add' | 'subtract'>('add');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<UserDetail | null>(null);

  // 获取用户详情
  useEffect(() => {
    const fetchUser = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const data = await api.get<UserDetail>(`/admin/users/${id}`);
        setUser(data);
        form.setFieldsValue({
          email: data.email,
          nickname: data.nickname || '',
          phone: data.phone || '',
          status: data.status || 'active',
        });
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : '获取用户信息失败';
        message.error(errorMessage);
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, [id, form]);

  // 保存用户信息
  const handleSaveInfo = async (values: Record<string, unknown>) => {
    if (!id) return;
    setSaving(true);
    try {
      await api.put(`/admin/users/${id}`, {
        nickname: values.nickname,
        email: values.email,
        phone: values.phone,
      });
      // 如果状态有变化，单独更新
      if (values.status !== user?.status) {
        await api.put(`/admin/users/${id}/status`, {
          status: values.status,
          reason: '管理员修改',
        });
      }
      message.success('用户信息已保存');
      // 刷新数据
      const data = await api.get<UserDetail>(`/admin/users/${id}`);
      setUser(data);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '保存失败';
      message.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  // 调整资产
  const handleAdjustAsset = async (values: Record<string, unknown>) => {
    if (!id || !user) return;
    const { amount, reason } = values;
    const assetLabels = { usdt: 'USDT', hoot: 'HOOT' };
    const assetLabel = assetLabels[assetType];
    const actionLabel = adjustType === 'add' ? '增加' : '减少';

    modal.confirm({
      title: '确认资产调整',
      icon: <ExclamationCircleOutlined />,
      content: (
        <div>
          <p>
            确定要为用户 <strong>{user.nickname || user.email}</strong> {actionLabel}{' '}
            <strong>
              {String(amount)} {assetLabel}
            </strong>{' '}
            吗？
          </p>
          <p>
            调整原因: <strong>{String(reason)}</strong>
          </p>
        </div>
      ),
      okText: '确认调整',
      cancelText: '取消',
      okButtonProps: { danger: adjustType === 'subtract' },
      async onOk() {
        try {
          const result = await api.post<{ message: string; newBalance: string }>(
            `/admin/users/${id}/adjust-balance`,
            {
              asset: assetType,
              action: adjustType,
              amount: String(amount),
              reason: String(reason),
            }
          );
          message.success(result.message);
          assetForm.resetFields();
          // 刷新用户数据
          const data = await api.get<UserDetail>(`/admin/users/${id}`);
          setUser(data);
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : '调整失败';
          message.error(errorMessage);
        }
      },
    });
  };

  // 重置密码
  const handleResetPassword = () => {
    if (!id || !user) return;
    modal.confirm({
      title: '确认重置密码',
      icon: <ExclamationCircleOutlined />,
      content: `确定要重置用户 ${user.nickname || user.email} 的密码吗？新密码将显示一次。`,
      okText: '确认重置',
      cancelText: '取消',
      okButtonProps: { danger: true },
      async onOk() {
        try {
          const result = await api.post<{ message: string; newPassword?: string }>(
            `/admin/users/${id}/reset-password`,
            {}
          );
          if (result.newPassword) {
            modal.success({
              title: '密码已重置',
              content: (
                <div>
                  <p>新密码：<Text copyable strong>{result.newPassword}</Text></p>
                  <p style={{ color: '#ff4d4f' }}>请立即复制保存，此密码只显示一次！</p>
                </div>
              ),
            });
          } else {
            message.success(result.message);
          }
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : '重置失败';
          message.error(errorMessage);
        }
      },
    });
  };

  if (loading) {
    return (
      <Edit saveButtonProps={{ style: { display: 'none' } }}>
        <div style={{ textAlign: 'center', padding: 50 }}>
          <Spin size="large" />
        </div>
      </Edit>
    );
  }

  if (!user) {
    return (
      <Edit saveButtonProps={{ style: { display: 'none' } }}>
        <Alert message="用户不存在" type="error" />
      </Edit>
    );
  }

  return (
    <Edit
      saveButtonProps={{ style: { display: 'none' } }}
      headerButtons={[
        <Button key="back" onClick={() => navigate(`/users/${id}`)}>
          返回详情
        </Button>,
      ]}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {/* 基本信息编辑 */}
        <Card title="基本信息">
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSaveInfo}
          >
            <Form.Item label="用户ID">
              <Input value={user.id} disabled />
            </Form.Item>

            <Form.Item
              label="邮箱"
              name="email"
              rules={[
                { required: true, message: '请输入邮箱' },
                { type: 'email', message: '请输入有效的邮箱地址' },
              ]}
            >
              <Input placeholder="请输入邮箱" />
            </Form.Item>

            <Form.Item
              label="昵称"
              name="nickname"
            >
              <Input placeholder="请输入昵称" />
            </Form.Item>

            <Form.Item label="手机号" name="phone">
              <Input placeholder="请输入手机号" />
            </Form.Item>

            <Form.Item
              label="账户状态"
              name="status"
              rules={[{ required: true, message: '请选择状态' }]}
            >
              <Select
                options={[
                  { label: '正常', value: 'active' },
                  { label: '冻结', value: 'frozen' },
                  { label: '封禁', value: 'banned' },
                ]}
              />
            </Form.Item>

            <Form.Item>
              <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving}>
                保存信息
              </Button>
            </Form.Item>
          </Form>
        </Card>

        {/* 重置密码 */}
        <Card title="安全设置">
          <Alert
            message="重置密码后，将生成一个新的随机密码"
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <Button danger onClick={handleResetPassword}>
            重置密码
          </Button>
        </Card>

        {/* 资产调整 */}
        <Card
          title={
            <Space>
              <span>资产调整</span>
              <Text type="secondary" style={{ fontSize: 14, fontWeight: 'normal' }}>
                (需超级管理员权限)
              </Text>
            </Space>
          }
        >
          <Alert
            message="资产调整属于敏感操作，所有调整都会被记录到审计日志中"
            type="warning"
            showIcon
            style={{ marginBottom: 24 }}
          />

          <div style={{ marginBottom: 16 }}>
            <Text strong>当前余额：</Text>
            <Space size="large" style={{ marginLeft: 16 }}>
              <span>
                USDT: <Text strong style={{ color: '#52c41a' }}>${parseFloat(user.usdtBalance || '0').toLocaleString()}</Text>
              </span>
              <span>
                HOOT: <Text strong style={{ color: '#1890ff' }}>{parseFloat(user.hootBalance || '0').toLocaleString()}</Text>
              </span>
            </Space>
          </div>

          <Divider />

          <Form
            form={assetForm}
            layout="vertical"
            onFinish={handleAdjustAsset}
          >
            <Form.Item label="资产类型">
              <Radio.Group
                value={assetType}
                onChange={(e) => setAssetType(e.target.value)}
              >
                <Radio.Button value="usdt">USDT</Radio.Button>
                <Radio.Button value="hoot">HOOT</Radio.Button>
              </Radio.Group>
            </Form.Item>

            <Form.Item label="调整类型">
              <Radio.Group
                value={adjustType}
                onChange={(e) => setAdjustType(e.target.value)}
              >
                <Radio.Button value="add" style={{ color: '#52c41a' }}>
                  增加
                </Radio.Button>
                <Radio.Button value="subtract" style={{ color: '#f5222d' }}>
                  减少
                </Radio.Button>
              </Radio.Group>
            </Form.Item>

            <Form.Item
              label="调整金额"
              name="amount"
              rules={[
                { required: true, message: '请输入调整金额' },
                {
                  type: 'number',
                  min: 0.01,
                  message: '金额必须大于0',
                },
              ]}
            >
              <InputNumber
                style={{ width: 200 }}
                placeholder="请输入金额"
                precision={assetType === 'usdt' ? 2 : 0}
                suffix={assetType.toUpperCase()}
              />
            </Form.Item>

            <Form.Item
              label="调整原因"
              name="reason"
              rules={[{ required: true, message: '请输入调整原因' }]}
            >
              <TextArea
                rows={3}
                placeholder="请详细说明调整原因（必填）"
                maxLength={200}
                showCount
              />
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                danger={adjustType === 'subtract'}
              >
                {adjustType === 'add' ? '确认增加' : '确认减少'}
              </Button>
            </Form.Item>
          </Form>
        </Card>
      </Space>
    </Edit>
  );
};
