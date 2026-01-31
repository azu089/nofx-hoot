/**
 * 管理员管理页面
 */
import { Card, Table, Tag, Space, Typography, Button, Modal, Form, Input, Select, Switch, message, Popconfirm, Avatar } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, UserOutlined, LockOutlined } from '@ant-design/icons';
import { useState } from 'react';

const { Title, Text } = Typography;

interface IAdmin {
  id: string;
  username: string;
  email: string;
  role: 'super_admin' | 'admin' | 'operator' | 'finance' | 'readonly';
  status: 'active' | 'disabled';
  lastLogin: string;
  createdAt: string;
}

const mockAdmins: IAdmin[] = [
  { id: '1', username: 'admin', email: 'admin@hoot.io', role: 'super_admin', status: 'active', lastLogin: '2025-01-30 14:30:00', createdAt: '2024-01-01' },
  { id: '2', username: 'operator1', email: 'operator1@hoot.io', role: 'operator', status: 'active', lastLogin: '2025-01-30 10:00:00', createdAt: '2024-06-15' },
  { id: '3', username: 'finance1', email: 'finance1@hoot.io', role: 'finance', status: 'active', lastLogin: '2025-01-29 16:00:00', createdAt: '2024-08-20' },
  { id: '4', username: 'viewer1', email: 'viewer1@hoot.io', role: 'readonly', status: 'disabled', lastLogin: '2025-01-20 09:00:00', createdAt: '2024-10-10' },
];

const roleMap: Record<string, { color: string; text: string }> = {
  super_admin: { color: 'red', text: '超级管理员' },
  admin: { color: 'orange', text: '管理员' },
  operator: { color: 'blue', text: '运营' },
  finance: { color: 'green', text: '财务' },
  readonly: { color: 'default', text: '只读' },
};

export const AdminsPage = () => {
  const [admins, setAdmins] = useState(mockAdmins);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<IAdmin | null>(null);
  const [form] = Form.useForm();

  const columns = [
    {
      title: '管理员',
      key: 'admin',
      render: (_: unknown, record: IAdmin) => (
        <Space>
          <Avatar icon={<UserOutlined />} style={{ backgroundColor: '#06B6D4' }} />
          <Space direction="vertical" size={0}>
            <Text strong>{record.username}</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>{record.email}</Text>
          </Space>
        </Space>
      ),
    },
    { title: '角色', dataIndex: 'role', key: 'role', render: (role: string) => <Tag color={roleMap[role].color}>{roleMap[role].text}</Tag> },
    { title: '状态', dataIndex: 'status', key: 'status', render: (status: string) => <Tag color={status === 'active' ? 'success' : 'default'}>{status === 'active' ? '启用' : '禁用'}</Tag> },
    { title: '最后登录', dataIndex: 'lastLogin', key: 'lastLogin' },
    { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt' },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: IAdmin) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => { setEditingAdmin(record); form.setFieldsValue(record); setModalVisible(true); }}>编辑</Button>
          <Button type="link" icon={<LockOutlined />} onClick={() => message.success('已发送重置密码邮件')}>重置密码</Button>
          {record.role !== 'super_admin' && (
            <Popconfirm title="确定删除？" onConfirm={() => { setAdmins(admins.filter(a => a.id !== record.id)); message.success('已删除'); }}>
              <Button type="link" danger icon={<DeleteOutlined />}>删除</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const handleSave = () => {
    form.validateFields().then(values => {
      if (editingAdmin) {
        setAdmins(admins.map(a => a.id === editingAdmin.id ? { ...a, ...values } : a));
        message.success('管理员已更新');
      } else {
        const newAdmin: IAdmin = { id: String(admins.length + 1), ...values, status: 'active', lastLogin: '-', createdAt: new Date().toISOString().split('T')[0] };
        setAdmins([...admins, newAdmin]);
        message.success('管理员已创建');
      }
      setModalVisible(false); setEditingAdmin(null); form.resetFields();
    });
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>管理员管理</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingAdmin(null); form.resetFields(); setModalVisible(true); }}>新增管理员</Button>
      </div>

      <Card>
        <Table dataSource={admins} columns={columns} rowKey="id" pagination={false} />
      </Card>

      <Modal title={editingAdmin ? '编辑管理员' : '新增管理员'} open={modalVisible} onOk={handleSave} onCancel={() => { setModalVisible(false); setEditingAdmin(null); form.resetFields(); }} width={500}>
        <Form form={form} layout="vertical">
          <Form.Item name="username" label="用户名" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="email" label="邮箱" rules={[{ required: true, type: 'email' }]}><Input /></Form.Item>
          {!editingAdmin && <Form.Item name="password" label="密码" rules={[{ required: true, min: 6 }]}><Input.Password /></Form.Item>}
          <Form.Item name="role" label="角色" rules={[{ required: true }]}>
            <Select options={Object.entries(roleMap).map(([k, v]) => ({ value: k, label: v.text }))} />
          </Form.Item>
          {editingAdmin && <Form.Item name="status" label="状态"><Switch checkedChildren="启用" unCheckedChildren="禁用" defaultChecked={editingAdmin.status === 'active'} /></Form.Item>}
        </Form>
      </Modal>
    </div>
  );
};
