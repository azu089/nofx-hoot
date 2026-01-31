/**
 * 用户编辑页面
 * 修改用户信息、调整资产
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
  message,
  Modal,
} from 'antd';
import {
  SaveOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useState } from 'react';
import { useParams } from 'react-router-dom';

const { Text } = Typography;
const { TextArea } = Input;

// 模拟用户数据
const mockUser = {
  id: '1',
  email: 'user1@example.com',
  username: 'trader_001',
  phone: '+86 138****8888',
  status: 'active',
  usdtBalance: '12500.00',
  usdtFrozen: '500.00',
  hootBalance: '50000',
  hootFrozen: '10000',
  pointCards: 15,
};

export const UserEdit = () => {
  const { id } = useParams<{ id: string }>();
  const [form] = Form.useForm();
  const [assetForm] = Form.useForm();
  const [assetType, setAssetType] = useState<'usdt' | 'hoot' | 'pointCards'>('usdt');
  const [adjustType, setAdjustType] = useState<'add' | 'subtract'>('add');

  const handleSaveInfo = (values: Record<string, unknown>) => {
    console.log('保存用户信息:', values);
    message.success('用户信息已保存');
  };

  const handleAdjustAsset = (values: Record<string, unknown>) => {
    const { amount, reason } = values;
    const assetLabels = { usdt: 'USDT', hoot: 'HOOT', pointCards: '点卡' };
    const assetLabel = assetLabels[assetType];
    const actionLabel = adjustType === 'add' ? '增加' : '减少';

    Modal.confirm({
      title: '确认资产调整',
      icon: <ExclamationCircleOutlined />,
      content: (
        <div>
          <p>
            确定要为用户 <strong>{mockUser.username}</strong> {actionLabel}{' '}
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
      onOk() {
        console.log('资产调整:', {
          userId: id,
          assetType,
          adjustType,
          amount,
          reason,
        });
        message.success('资产调整成功');
        assetForm.resetFields();
      },
    });
  };

  return (
    <Edit saveButtonProps={{ style: { display: 'none' } }}>
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {/* 基本信息编辑 */}
        <Card title="基本信息">
          <Form
            form={form}
            layout="vertical"
            initialValues={mockUser}
            onFinish={handleSaveInfo}
          >
            <Form.Item label="用户ID">
              <Input value={mockUser.id} disabled />
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
              label="用户名"
              name="username"
              rules={[{ required: true, message: '请输入用户名' }]}
            >
              <Input placeholder="请输入用户名" />
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
              <Button type="primary" htmlType="submit" icon={<SaveOutlined />}>
                保存信息
              </Button>
            </Form.Item>
          </Form>
        </Card>

        {/* 重置密码 */}
        <Card title="安全设置">
          <Alert
            message="重置密码后，用户将收到一封包含新密码的邮件"
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <Button
            danger
            onClick={() => {
              Modal.confirm({
                title: '确认重置密码',
                icon: <ExclamationCircleOutlined />,
                content: `确定要重置用户 ${mockUser.username} 的密码吗？新密码将发送到用户邮箱。`,
                okText: '确认重置',
                cancelText: '取消',
                okButtonProps: { danger: true },
                onOk() {
                  message.success('密码已重置，新密码已发送至用户邮箱');
                },
              });
            }}
          >
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
                USDT 可用: <Text strong style={{ color: '#52c41a' }}>${mockUser.usdtBalance}</Text>
              </span>
              <span>
                USDT 冻结: <Text strong style={{ color: '#faad14' }}>${mockUser.usdtFrozen}</Text>
              </span>
              <span>
                HOOT 可用: <Text strong style={{ color: '#1890ff' }}>{mockUser.hootBalance}</Text>
              </span>
              <span>
                HOOT 冻结: <Text strong style={{ color: '#faad14' }}>{mockUser.hootFrozen}</Text>
              </span>
              <span>
                点卡: <Text strong style={{ color: '#d4b106' }}>{mockUser.pointCards} 张</Text>
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
                <Radio.Button value="pointCards">点卡</Radio.Button>
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
              label={assetType === 'pointCards' ? '调整数量' : '调整金额'}
              name="amount"
              rules={[
                { required: true, message: assetType === 'pointCards' ? '请输入调整数量' : '请输入调整金额' },
                {
                  type: 'number',
                  min: assetType === 'pointCards' ? 1 : 0.01,
                  message: assetType === 'pointCards' ? '数量必须大于0' : '金额必须大于0',
                },
              ]}
            >
              <InputNumber
                style={{ width: 200 }}
                placeholder={assetType === 'pointCards' ? '请输入数量' : '请输入金额'}
                precision={assetType === 'usdt' ? 2 : 0}
                addonAfter={assetType === 'pointCards' ? '张' : assetType.toUpperCase()}
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
