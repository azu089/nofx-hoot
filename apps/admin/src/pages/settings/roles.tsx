/**
 * 角色权限页面
 */
import { Card, Table, Tag, Space, Typography, Button, Modal, Form, Input, Checkbox, Popconfirm, Collapse, Row, Col } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { useMessage } from '../../hooks';

const { Title, Text } = Typography;
const { Panel } = Collapse;

interface IRole {
  id: string;
  name: string;
  key: string;
  description: string;
  permissions: string[];
  isSystem: boolean;
  userCount: number;
}

// 权限列表
const permissionGroups = [
  { key: 'users', label: '用户管理', permissions: [
    { key: 'users:view', label: '查看用户' },
    { key: 'users:edit', label: '编辑用户' },
    { key: 'users:freeze', label: '冻结用户' },
    { key: 'users:adjust_balance', label: '调整资产' },
  ]},
  { key: 'strategies', label: '策略管理', permissions: [
    { key: 'strategies:view', label: '查看策略' },
    { key: 'strategies:edit', label: '编辑策略' },
    { key: 'strategies:publish', label: '上下架策略' },
  ]},
  { key: 'finance', label: '财务中心', permissions: [
    { key: 'finance:view', label: '查看财务' },
    { key: 'finance:audit', label: '审核提现' },
    { key: 'finance:adjust', label: '调账' },
  ]},
  { key: 'announcements', label: '公告管理', permissions: [
    { key: 'announcements:view', label: '查看公告' },
    { key: 'announcements:publish', label: '发布公告' },
    { key: 'announcements:edit', label: '编辑公告' },
    { key: 'announcements:delete', label: '删除公告' },
  ]},
  { key: 'content', label: '内容配置', permissions: [
    { key: 'content:view', label: '查看配置' },
    { key: 'content:edit', label: '编辑配置' },
  ]},
  { key: 'ecosystem', label: '生态中心', permissions: [
    { key: 'ecosystem:view', label: '查看生态' },
    { key: 'ecosystem:operate', label: '操作生态' },
  ]},
  { key: 'logs', label: '日志中心', permissions: [
    { key: 'logs:view', label: '查看日志' },
    { key: 'logs:export', label: '导出日志' },
  ]},
  { key: 'settings', label: '系统设置', permissions: [
    { key: 'settings:view', label: '查看设置' },
    { key: 'settings:edit', label: '编辑设置' },
  ]},
];

const mockRoles: IRole[] = [
  { id: '1', name: '超级管理员', key: 'super_admin', description: '拥有所有权限', permissions: permissionGroups.flatMap(g => g.permissions.map(p => p.key)), isSystem: true, userCount: 1 },
  { id: '2', name: '管理员', key: 'admin', description: '除系统设置外全部权限', permissions: permissionGroups.filter(g => g.key !== 'settings').flatMap(g => g.permissions.map(p => p.key)), isSystem: true, userCount: 2 },
  { id: '3', name: '运营', key: 'operator', description: '用户、公告、内容管理', permissions: ['users:view', 'users:edit', 'announcements:view', 'announcements:publish', 'announcements:edit', 'content:view', 'content:edit'], isSystem: true, userCount: 3 },
  { id: '4', name: '财务', key: 'finance', description: '财务中心全部权限', permissions: ['finance:view', 'finance:audit', 'finance:adjust'], isSystem: true, userCount: 2 },
  { id: '5', name: '只读', key: 'readonly', description: '查看全部，无操作权限', permissions: permissionGroups.flatMap(g => g.permissions.filter(p => p.key.endsWith(':view')).map(p => p.key)), isSystem: true, userCount: 1 },
];

export const RolesPage = () => {
  const message = useMessage();
  const [roles, setRoles] = useState(mockRoles);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRole, setEditingRole] = useState<IRole | null>(null);
  const [form] = Form.useForm();
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  const columns = [
    { title: '角色名称', dataIndex: 'name', key: 'name', width: 140, render: (name: string, record: IRole) => <Space><Text strong>{name}</Text>{record.isSystem && <Tag>系统</Tag>}</Space> },
    { title: '角色标识', dataIndex: 'key', key: 'key', width: 120, render: (key: string) => <Text code style={{ whiteSpace: 'nowrap' }}>{key}</Text> },
    { title: '描述', dataIndex: 'description', key: 'description', width: 180 },
    { title: '权限数', key: 'permCount', width: 90, render: (_: unknown, record: IRole) => <Tag color="blue">{record.permissions.length} 项</Tag> },
    { title: '用户数', dataIndex: 'userCount', key: 'userCount', width: 80 },
    {
      title: '操作',
      key: 'action',
      width: 140,
      fixed: 'right' as const,
      render: (_: unknown, record: IRole) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => { setEditingRole(record); form.setFieldsValue(record); setSelectedPermissions(record.permissions); setModalVisible(true); }}>编辑</Button>
          {!record.isSystem && (
            <Popconfirm title="确定删除？" onConfirm={() => { setRoles(roles.filter(r => r.id !== record.id)); message.success('已删除'); }}>
              <Button type="link" danger icon={<DeleteOutlined />}>删除</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const handleSave = () => {
    form.validateFields().then(values => {
      if (editingRole) {
        setRoles(roles.map(r => r.id === editingRole.id ? { ...r, ...values, permissions: selectedPermissions } : r));
        message.success('角色已更新');
      } else {
        const newRole: IRole = { id: String(roles.length + 1), ...values, permissions: selectedPermissions, isSystem: false, userCount: 0 };
        setRoles([...roles, newRole]);
        message.success('角色已创建');
      }
      setModalVisible(false); setEditingRole(null); form.resetFields(); setSelectedPermissions([]);
    });
  };

  const handlePermissionChange = (groupKey: string, checked: boolean) => {
    const group = permissionGroups.find(g => g.key === groupKey);
    if (group) {
      const perms = group.permissions.map(p => p.key);
      if (checked) {
        setSelectedPermissions([...new Set([...selectedPermissions, ...perms])]);
      } else {
        setSelectedPermissions(selectedPermissions.filter(p => !perms.includes(p)));
      }
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>角色权限</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingRole(null); form.resetFields(); setSelectedPermissions([]); setModalVisible(true); }}>新增角色</Button>
      </div>

      <Card>
        <Table dataSource={roles} columns={columns} rowKey="id" pagination={false} scroll={{ x: 750 }} expandable={{
          expandedRowRender: (record) => (
            <Space wrap>{record.permissions.map(p => <Tag key={p}>{permissionGroups.flatMap(g => g.permissions).find(pp => pp.key === p)?.label || p}</Tag>)}</Space>
          ),
        }} />
      </Card>

      <Modal title={editingRole ? '编辑角色' : '新增角色'} open={modalVisible} onOk={handleSave} onCancel={() => { setModalVisible(false); setEditingRole(null); form.resetFields(); setSelectedPermissions([]); }} width={700}>
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}><Form.Item name="name" label="角色名称" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="key" label="角色标识" rules={[{ required: true }]}><Input disabled={editingRole?.isSystem} /></Form.Item></Col>
          </Row>
          <Form.Item name="description" label="描述"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item label="权限配置">
            <Collapse>
              {permissionGroups.map(group => {
                const groupPerms = group.permissions.map(p => p.key);
                const checkedCount = groupPerms.filter(p => selectedPermissions.includes(p)).length;
                const allChecked = checkedCount === groupPerms.length;
                return (
                  <Panel key={group.key} header={<Space><Checkbox indeterminate={checkedCount > 0 && !allChecked} checked={allChecked} onChange={(e) => handlePermissionChange(group.key, e.target.checked)} /><Text strong>{group.label}</Text><Tag>{checkedCount}/{groupPerms.length}</Tag></Space>}>
                    <Checkbox.Group value={selectedPermissions} onChange={(vals) => setSelectedPermissions(vals as string[])}>
                      <Row>{group.permissions.map(p => <Col span={12} key={p.key}><Checkbox value={p.key}>{p.label}</Checkbox></Col>)}</Row>
                    </Checkbox.Group>
                  </Panel>
                );
              })}
            </Collapse>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
