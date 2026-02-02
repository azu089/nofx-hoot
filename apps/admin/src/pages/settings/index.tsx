/**
 * 系统设置页面
 * 管理员管理、权限设置、安全配置
 */
import { useState } from 'react';
import { List } from '@refinedev/antd';
import {
  Card,
  Tabs,
  Table,
  Tag,
  Space,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  Alert,
  Typography,
  Avatar,
  Tooltip,
  Row,
  Col,
} from 'antd';
import {
  UserOutlined,
  LockOutlined,
  SafetyOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
  KeyOutlined,
} from '@ant-design/icons';
import { useMessage } from '../../hooks';

const { Text } = Typography;

interface IAdmin {
  id: string;
  username: string;
  email: string;
  role: 'super_admin' | 'admin' | 'operator' | 'viewer';
  status: 'active' | 'disabled';
  lastLogin: string;
  createdAt: string;
}

// 模拟管理员数据
const mockAdmins: IAdmin[] = [
  {
    id: '1',
    username: 'superadmin',
    email: 'super@hoot.com',
    role: 'super_admin',
    status: 'active',
    lastLogin: '2025-01-30 14:32',
    createdAt: '2024-01-01',
  },
  {
    id: '2',
    username: 'admin_finance',
    email: 'finance@hoot.com',
    role: 'admin',
    status: 'active',
    lastLogin: '2025-01-30 10:15',
    createdAt: '2024-03-15',
  },
  {
    id: '3',
    username: 'operator_cs',
    email: 'cs@hoot.com',
    role: 'operator',
    status: 'active',
    lastLogin: '2025-01-29 18:00',
    createdAt: '2024-06-01',
  },
  {
    id: '4',
    username: 'viewer_audit',
    email: 'audit@hoot.com',
    role: 'viewer',
    status: 'disabled',
    lastLogin: '2025-01-15 09:00',
    createdAt: '2024-09-01',
  },
];

// 角色权限配置
const rolePermissions = {
  super_admin: {
    label: '超级管理员',
    color: 'red',
    permissions: ['用户管理', '资产调整', '策略管理', '财务管理', '系统设置', '日志查看'],
  },
  admin: {
    label: '管理员',
    color: 'orange',
    permissions: ['用户管理', '策略管理', '财务管理', '日志查看'],
  },
  operator: {
    label: '运营',
    color: 'blue',
    permissions: ['用户查看', '公告管理', '内容配置'],
  },
  viewer: {
    label: '只读',
    color: 'default',
    permissions: ['数据查看'],
  },
};

export const SettingsPage = () => {
  const message = useMessage();
  const [admins, setAdmins] = useState<IAdmin[]>(mockAdmins);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<IAdmin | null>(null);
  const [form] = Form.useForm();

  const handleAddAdmin = () => {
    setEditingAdmin(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEditAdmin = (admin: IAdmin) => {
    setEditingAdmin(admin);
    form.setFieldsValue(admin);
    setModalVisible(true);
  };

  const handleDeleteAdmin = (admin: IAdmin) => {
    if (admin.role === 'super_admin') {
      message.error('不能删除超级管理员');
      return;
    }

    Modal.confirm({
      title: '确认删除管理员',
      icon: <ExclamationCircleOutlined />,
      content: `确定要删除管理员 ${admin.username} 吗？此操作不可恢复。`,
      okText: '确认删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk() {
        setAdmins(admins.filter((a) => a.id !== admin.id));
        message.success('管理员已删除');
      },
    });
  };

  const handleSaveAdmin = async () => {
    try {
      const values = await form.validateFields();
      if (editingAdmin) {
        setAdmins(
          admins.map((a) =>
            a.id === editingAdmin.id ? { ...a, ...values } : a
          )
        );
        message.success('管理员信息已更新');
      } else {
        const newAdmin: IAdmin = {
          id: String(Date.now()),
          ...values,
          status: 'active',
          lastLogin: '-',
          createdAt: new Date().toISOString().split('T')[0],
        };
        setAdmins([...admins, newAdmin]);
        message.success('管理员已添加');
      }
      setModalVisible(false);
    } catch (error) {
      console.error('保存失败:', error);
    }
  };

  const adminColumns = [
    {
      title: '管理员',
      key: 'admin',
      render: (_: unknown, record: IAdmin) => (
        <Space>
          <Avatar icon={<UserOutlined />} />
          <div>
            <div style={{ fontWeight: 500 }}>{record.username}</div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.email}
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      render: (role: keyof typeof rolePermissions) => (
        <Tag color={rolePermissions[role].color}>
          {rolePermissions[role].label}
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'active' ? 'green' : 'default'}>
          {status === 'active' ? '正常' : '已禁用'}
        </Tag>
      ),
    },
    {
      title: '最后登录',
      dataIndex: 'lastLogin',
      key: 'lastLogin',
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: unknown, record: IAdmin) => (
        <Space>
          <Tooltip title="编辑">
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEditAdmin(record)}
            />
          </Tooltip>
          <Tooltip title="重置密码">
            <Button
              size="small"
              icon={<KeyOutlined />}
              onClick={() => {
                Modal.confirm({
                  title: '重置密码',
                  content: `确定要重置 ${record.username} 的密码吗？`,
                  onOk() {
                    message.success('密码已重置，新密码已发送至邮箱');
                  },
                });
              }}
            />
          </Tooltip>
          <Tooltip title="删除">
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDeleteAdmin(record)}
              disabled={record.role === 'super_admin'}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const tabItems = [
    {
      key: 'admins',
      label: (
        <span>
          <UserOutlined />
          管理员管理
        </span>
      ),
      children: (
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Text type="secondary">管理后台用户和权限分配</Text>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAddAdmin}>
              添加管理员
            </Button>
          </div>
          <Table
            dataSource={admins}
            columns={adminColumns}
            rowKey="id"
            pagination={false}
          />
        </Space>
      ),
    },
    {
      key: 'permissions',
      label: (
        <span>
          <LockOutlined />
          权限配置
        </span>
      ),
      children: (
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <Alert
            message="权限说明"
            description="不同角色拥有不同的操作权限，请根据工作职责分配合适的角色。"
            type="info"
            showIcon
          />
          <Row gutter={16}>
            {Object.entries(rolePermissions).map(([key, value]) => (
              <Col span={6} key={key}>
                <Card
                  title={
                    <Tag color={value.color} style={{ margin: 0 }}>
                      {value.label}
                    </Tag>
                  }
                  size="small"
                >
                  {value.permissions.map((perm) => (
                    <div key={perm} style={{ marginBottom: 4 }}>
                      <Text>• {perm}</Text>
                    </div>
                  ))}
                </Card>
              </Col>
            ))}
          </Row>
        </Space>
      ),
    },
    {
      key: 'security',
      label: (
        <span>
          <SafetyOutlined />
          安全设置
        </span>
      ),
      children: (
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <Card title="登录安全">
            <Form layout="vertical">
              <Form.Item
                label="登录验证码"
                extra="开启后登录需要输入验证码"
              >
                <Switch checkedChildren="开" unCheckedChildren="关" defaultChecked />
              </Form.Item>
              <Form.Item
                label="二次验证 (2FA)"
                extra="开启后敏感操作需要二次验证"
              >
                <Switch checkedChildren="开" unCheckedChildren="关" defaultChecked />
              </Form.Item>
              <Form.Item
                label="登录失败锁定"
                extra="连续5次登录失败后锁定账户30分钟"
              >
                <Switch checkedChildren="开" unCheckedChildren="关" defaultChecked />
              </Form.Item>
              <Form.Item
                label="IP 白名单"
                extra="只允许指定 IP 访问后台"
              >
                <Switch checkedChildren="开" unCheckedChildren="关" />
              </Form.Item>
            </Form>
          </Card>

          <Card title="操作安全">
            <Form layout="vertical">
              <Form.Item
                label="资产调整需要审批"
                extra="资产调整操作需要另一管理员审批"
              >
                <Switch checkedChildren="开" unCheckedChildren="关" defaultChecked />
              </Form.Item>
              <Form.Item
                label="大额提现预警"
                extra="单笔提现超过 10000 USDT 时发送预警"
              >
                <Switch checkedChildren="开" unCheckedChildren="关" defaultChecked />
              </Form.Item>
              <Form.Item
                label="敏感操作日志"
                extra="记录所有敏感操作的详细日志"
              >
                <Switch checkedChildren="开" unCheckedChildren="关" defaultChecked />
              </Form.Item>
            </Form>
          </Card>

          <Button type="primary" onClick={() => message.success('安全设置已保存')}>
            保存安全设置
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <List>
      <Card>
        <Tabs items={tabItems} />
      </Card>

      {/* 添加/编辑管理员弹窗 */}
      <Modal
        title={editingAdmin ? '编辑管理员' : '添加管理员'}
        open={modalVisible}
        onOk={handleSaveAdmin}
        onCancel={() => setModalVisible(false)}
        okText={editingAdmin ? '保存' : '添加'}
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="用户名"
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input prefix={<UserOutlined />} placeholder="用户名" />
          </Form.Item>
          <Form.Item
            label="邮箱"
            name="email"
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '请输入有效的邮箱' },
            ]}
          >
            <Input placeholder="邮箱" />
          </Form.Item>
          {!editingAdmin && (
            <Form.Item
              label="初始密码"
              name="password"
              rules={[{ required: true, message: '请输入初始密码' }]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder="初始密码" />
            </Form.Item>
          )}
          <Form.Item
            label="角色"
            name="role"
            rules={[{ required: true, message: '请选择角色' }]}
          >
            <Select
              placeholder="选择角色"
              options={Object.entries(rolePermissions).map(([key, value]) => ({
                label: value.label,
                value: key,
              }))}
            />
          </Form.Item>
          {editingAdmin && (
            <Form.Item
              label="状态"
              name="status"
              rules={[{ required: true, message: '请选择状态' }]}
            >
              <Select
                options={[
                  { label: '正常', value: 'active' },
                  { label: '禁用', value: 'disabled' },
                ]}
              />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </List>
  );
};
