/**
 * 前端文案配置页面
 * 管理前端显示的文字内容
 */
import { useState } from 'react';
import { List } from '@refinedev/antd';
import {
  Table,
  Tag,
  Space,
  Button,
  Modal,
  Form,
  Input,
  Tabs,
  Card,
  Typography,
} from 'antd';
import {
  EditOutlined,
  SaveOutlined,
  UndoOutlined,
} from '@ant-design/icons';
import { useMessage } from '../../hooks';

const { Text } = Typography;

interface ITextConfig {
  id: string;
  key: string;
  group: string;
  zhValue: string;
  enValue: string;
  description: string;
  defaultValue: string;
}

// 模拟数据
const mockTextConfigs: ITextConfig[] = [
  // 首页
  {
    id: '1',
    key: 'home.hero.title',
    group: 'home',
    zhValue: 'AI 驱动的量化交易平台',
    enValue: 'AI-Powered Quantitative Trading Platform',
    description: '首页主标题',
    defaultValue: 'AI 驱动的量化交易平台',
  },
  {
    id: '2',
    key: 'home.hero.subtitle',
    group: 'home',
    zhValue: '让专业策略为你创造收益',
    enValue: 'Let Professional Strategies Create Profits for You',
    description: '首页副标题',
    defaultValue: '让专业策略为你创造收益',
  },
  {
    id: '3',
    key: 'home.cta.primary',
    group: 'home',
    zhValue: '立即开始',
    enValue: 'Get Started',
    description: '首页主按钮文字',
    defaultValue: '立即开始',
  },
  // 登录注册
  {
    id: '4',
    key: 'auth.login.title',
    group: 'auth',
    zhValue: '欢迎回来',
    enValue: 'Welcome Back',
    description: '登录页标题',
    defaultValue: '欢迎回来',
  },
  {
    id: '5',
    key: 'auth.register.title',
    group: 'auth',
    zhValue: '创建账户',
    enValue: 'Create Account',
    description: '注册页标题',
    defaultValue: '创建账户',
  },
  // 仪表盘
  {
    id: '6',
    key: 'dashboard.totalAssets',
    group: 'dashboard',
    zhValue: '总资产',
    enValue: 'Total Assets',
    description: '仪表盘 - 总资产标签',
    defaultValue: '总资产',
  },
  {
    id: '7',
    key: 'dashboard.todayPnl',
    group: 'dashboard',
    zhValue: '今日盈亏',
    enValue: "Today's P&L",
    description: '仪表盘 - 今日盈亏标签',
    defaultValue: '今日盈亏',
  },
  // 策略市场
  {
    id: '8',
    key: 'strategies.subscribe',
    group: 'strategies',
    zhValue: '订阅策略',
    enValue: 'Subscribe',
    description: '策略订阅按钮',
    defaultValue: '订阅策略',
  },
  // 钱包
  {
    id: '9',
    key: 'wallet.deposit',
    group: 'wallet',
    zhValue: '充值',
    enValue: 'Deposit',
    description: '充值按钮',
    defaultValue: '充值',
  },
  {
    id: '10',
    key: 'wallet.withdraw',
    group: 'wallet',
    zhValue: '提现',
    enValue: 'Withdraw',
    description: '提现按钮',
    defaultValue: '提现',
  },
];

const groupLabels: Record<string, string> = {
  home: '首页文案',
  auth: '登录注册',
  dashboard: '仪表盘',
  strategies: '策略市场',
  wallet: '钱包页面',
  common: '通用文案',
  error: '错误提示',
};

export const TextConfigList = () => {
  const message = useMessage();
  const [dataSource, setDataSource] = useState<ITextConfig[]>(mockTextConfigs);
  const [editingKey, setEditingKey] = useState<string>('');
  const [form] = Form.useForm();
  const [activeGroup, setActiveGroup] = useState<string>('home');

  const groups = [...new Set(mockTextConfigs.map((item) => item.group))];

  const handleEdit = (record: ITextConfig) => {
    form.setFieldsValue(record);
    setEditingKey(record.key);
  };

  const handleSave = async (key: string) => {
    try {
      const values = await form.validateFields();
      setDataSource((prev) =>
        prev.map((item) =>
          item.key === key ? { ...item, ...values } : item
        )
      );
      setEditingKey('');
      message.success('已保存');
    } catch (error) {
      console.error('保存失败:', error);
    }
  };

  const handleCancel = () => {
    setEditingKey('');
  };

  const handleReset = (record: ITextConfig) => {
    Modal.confirm({
      title: '确认重置',
      content: `确定要将「${record.description}」重置为默认值吗？`,
      okText: '确认',
      cancelText: '取消',
      onOk() {
        setDataSource((prev) =>
          prev.map((item) =>
            item.key === record.key
              ? { ...item, zhValue: item.defaultValue }
              : item
          )
        );
        message.success('已重置');
      },
    });
  };

  const columns = [
    {
      title: 'Key',
      dataIndex: 'key',
      key: 'key',
      width: 200,
      render: (key: string) => <Text code>{key}</Text>,
    },
    {
      title: '说明',
      dataIndex: 'description',
      key: 'description',
      width: 150,
    },
    {
      title: '中文内容',
      dataIndex: 'zhValue',
      key: 'zhValue',
      render: (value: string, record: ITextConfig) =>
        editingKey === record.key ? (
          <Form.Item name="zhValue" style={{ margin: 0 }}>
            <Input />
          </Form.Item>
        ) : (
          <span>
            {value}
            {value !== record.defaultValue && (
              <Tag color="orange" style={{ marginLeft: 8 }}>
                已修改
              </Tag>
            )}
          </span>
        ),
    },
    {
      title: '英文内容',
      dataIndex: 'enValue',
      key: 'enValue',
      render: (value: string, record: ITextConfig) =>
        editingKey === record.key ? (
          <Form.Item name="enValue" style={{ margin: 0 }}>
            <Input />
          </Form.Item>
        ) : (
          value
        ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 150,
      render: (_: unknown, record: ITextConfig) =>
        editingKey === record.key ? (
          <Space>
            <Button
              size="small"
              type="primary"
              icon={<SaveOutlined />}
              onClick={() => handleSave(record.key)}
            >
              保存
            </Button>
            <Button size="small" onClick={handleCancel}>
              取消
            </Button>
          </Space>
        ) : (
          <Space>
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            >
              编辑
            </Button>
            {record.zhValue !== record.defaultValue && (
              <Button
                size="small"
                icon={<UndoOutlined />}
                onClick={() => handleReset(record)}
              >
                重置
              </Button>
            )}
          </Space>
        ),
    },
  ];

  const tabItems = groups.map((group) => ({
    key: group,
    label: groupLabels[group] || group,
    children: (
      <Form form={form} component={false}>
        <Table
          dataSource={dataSource.filter((item) => item.group === group)}
          columns={columns}
          rowKey="key"
          pagination={false}
        />
      </Form>
    ),
  }));

  return (
    <List>
      <Card>
        <Tabs
          activeKey={activeGroup}
          onChange={setActiveGroup}
          items={tabItems}
        />
      </Card>
    </List>
  );
};
