/**
 * 管理员管理页面
 * 连接真实后端 API
 */
import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Table,
  Tag,
  Space,
  Typography,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  Popconfirm,
  Avatar,
  Spin,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  UserOutlined,
  LockOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { adminApi } from '../../lib/admin-api';
import { useMessage } from '../../hooks';

const { Title, Text } = Typography;

interface IAdmin {
  id: string;
  username: string;
  email: string;
  role: string;
  status: string;
  lastLoginAt: string | null;
  createdAt: string;
}

const roleMap: Record<string, { color: string; text: string }> = {
  super_admin: { color: 'red', text: '超级管理员' },
  admin: { color: 'orange', text: '管理员' },
  operator: { color: 'blue', text: '运营' },
  finance: { color: 'green', text: '财务' },
  readonly: { color: 'default', text: '只读' },
};

export const AdminsPage = () => {
  const message = useMessage();
  const [admins, setAdmins] = useState<IAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<IAdmin | null>(null);
  const [form] = Form.useForm();

  // 加载管理员列表
  const loadAdmins = useCallback(async () => {
    setLoading(true);
    try {
      const response = await adminApi.get(`/admin/admins?page=${page}&limit=${pageSize}`);
      if (response.data.code === 0) {
        const data = response.data.data as { items: IAdmin[]; total: number };
        setAdmins(data.items || []);
        setTotal(data.total || 0);
      } else {
        message.error(response.data.message || '加载失败');
      }
    } catch (error: any) {
      console.error('加载管理员列表失败:', error);
      message.error(error.response?.data?.message || '加载管理员列表失败');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => {
    loadAdmins();
  }, [loadAdmins]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);

      if (editingAdmin) {
        // 编辑
        const response = await adminApi.put(`/admin/admins/${editingAdmin.id}`, {
          role: values.role,
          status: values.status ? 'active' : 'disabled',
        });
        if (response.data.code === 0) {
          message.success('管理员已更新');
          loadAdmins();
        } else {
          message.error(response.data.message || '更新失败');
        }
      } else {
        // 新增
        const response = await adminApi.post('/admin/admins', {
          username: values.username,
          email: values.email,
          password: values.password,
          role: values.role,
        });
        if (response.data.code === 0) {
          message.success('管理员已创建');
          loadAdmins();
        } else {
          message.error(response.data.message || '创建失败');
        }
      }

      setModalVisible(false);
      setEditingAdmin(null);
      form.resetFields();
    } catch (error: any) {
      console.error('保存失败:', error);
      message.error(error.response?.data?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (admin: IAdmin) => {
    try {
      const response = await adminApi.delete(`/admin/admins/${admin.id}`);
      if (response.data.code === 0) {
        message.success('管理员已删除');
        loadAdmins();
      } else {
        message.error(response.data.message || '删除失败');
      }
    } catch (error: any) {
      console.error('删除失败:', error);
      message.error(error.response?.data?.message || '删除失败');
    }
  };

  const handleResetPassword = async (admin: IAdmin) => {
    try {
      const response = await adminApi.post(`/admin/admins/${admin.id}/reset-password`);
      if (response.data.code === 0) {
        message.success('已发送重置密码邮件');
      } else {
        message.error(response.data.message || '操作失败');
      }
    } catch (error: any) {
      console.error('重置密码失败:', error);
      message.error(error.response?.data?.message || '重置密码失败');
    }
  };

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
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => {
        const config = roleMap[role] || { color: 'default', text: role };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'active' ? 'success' : 'default'}>
          {status === 'active' ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '最后登录',
      dataIndex: 'lastLoginAt',
      key: 'lastLoginAt',
      render: (date: string | null) => date ? new Date(date).toLocaleString() : '-',
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => date ? new Date(date).toLocaleDateString() : '-',
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: IAdmin) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => {
              setEditingAdmin(record);
              form.setFieldsValue({
                ...record,
                status: record.status === 'active',
              });
              setModalVisible(true);
            }}
          >
            编辑
          </Button>
          <Button
            type="link"
            icon={<LockOutlined />}
            onClick={() => handleResetPassword(record)}
          >
            重置密码
          </Button>
          {record.role !== 'super_admin' && (
            <Popconfirm
              title="确定删除该管理员？"
              onConfirm={() => handleDelete(record)}
              okText="确定"
              cancelText="取消"
            >
              <Button type="link" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>管理员管理</Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadAdmins} loading={loading}>
            刷新
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingAdmin(null);
              form.resetFields();
              setModalVisible(true);
            }}
          >
            新增管理员
          </Button>
        </Space>
      </div>

      <Card>
        <Spin spinning={loading}>
          <Table
            dataSource={admins}
            columns={columns}
            rowKey="id"
            scroll={{ x: 900 }}
            pagination={{
              current: page,
              pageSize: pageSize,
              total: total,
              showTotal: (t) => `共 ${t} 条`,
              onChange: (p) => setPage(p),
            }}
          />
        </Spin>
      </Card>

      <Modal
        title={editingAdmin ? '编辑管理员' : '新增管理员'}
        open={modalVisible}
        onOk={handleSave}
        onCancel={() => {
          setModalVisible(false);
          setEditingAdmin(null);
          form.resetFields();
        }}
        confirmLoading={saving}
        width={500}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="username"
            label="用户名"
            rules={[{ required: !editingAdmin, message: '请输入用户名' }]}
          >
            <Input disabled={!!editingAdmin} placeholder="请输入用户名" />
          </Form.Item>
          <Form.Item
            name="email"
            label="邮箱"
            rules={[
              { required: !editingAdmin, message: '请输入邮箱' },
              { type: 'email', message: '请输入有效的邮箱地址' },
            ]}
          >
            <Input disabled={!!editingAdmin} placeholder="请输入邮箱" />
          </Form.Item>
          {!editingAdmin && (
            <Form.Item
              name="password"
              label="密码"
              rules={[
                { required: true, message: '请输入密码' },
                { min: 6, message: '密码至少 6 位' },
              ]}
            >
              <Input.Password placeholder="请输入密码" />
            </Form.Item>
          )}
          <Form.Item
            name="role"
            label="角色"
            rules={[{ required: true, message: '请选择角色' }]}
          >
            <Select
              placeholder="请选择角色"
              options={Object.entries(roleMap).map(([k, v]) => ({
                value: k,
                label: v.text,
              }))}
            />
          </Form.Item>
          {editingAdmin && (
            <Form.Item name="status" label="状态" valuePropName="checked">
              <Switch checkedChildren="启用" unCheckedChildren="禁用" />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  );
};
