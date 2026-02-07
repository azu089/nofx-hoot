import { useState, useEffect } from 'react';
import { Card, Switch, Alert, Empty, Modal, Typography } from 'antd';
import { api } from '../../lib/api';
import { useMessage } from '../../hooks';

const { Title, Paragraph } = Typography;

export const AppInstallPage = () => {
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [updating, setUpdating] = useState(false);
  const { success, error } = useMessage();

  // 加载配置
  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const value = await api.get<boolean>('/admin/config/pwa_install_enabled');
      setEnabled(!!value);
    } catch (err) {
      error('加载配置失败');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (checked: boolean) => {
    // 如果是禁用操作，先确认
    if (!checked) {
      Modal.confirm({
        title: '确认禁用安装提示？',
        content: '禁用后，用户将不会看到 PWA 安装引导',
        okText: '确认禁用',
        cancelText: '取消',
        onOk: () => updateConfig(checked),
      });
    } else {
      updateConfig(checked);
    }
  };

  const updateConfig = async (value: boolean) => {
    try {
      setUpdating(true);
      await api.put('/admin/config/pwa_install_enabled', { value });
      setEnabled(value);
      success(value ? '已启用安装提示' : '已禁用安装提示');
    } catch (err) {
      error('更新配置失败');
      console.error(err);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>安装应用管理</Title>

      <Card
        title="PWA 安装提示"
        style={{ marginBottom: '24px' }}
        loading={loading}
      >
        <div style={{ marginBottom: '16px' }}>
          <Switch
            checked={enabled}
            loading={updating}
            onChange={handleToggle}
            checkedChildren="已启用"
            unCheckedChildren="已禁用"
          />
          <span style={{ marginLeft: '12px', color: '#666' }}>
            {enabled ? '启用安装提示' : '禁用安装提示'}
          </span>
        </div>

        <Paragraph type="secondary" style={{ marginBottom: '16px' }}>
          启用后，用户在移动端访问时会看到安装提示，引导将 HOOT 添加到手机桌面
        </Paragraph>

        <Alert
          type="info"
          message="PWA 安装支持 iOS Safari (添加到主屏幕) 和 Android Chrome (安装应用)"
          showIcon
        />
      </Card>

      <Card title="统计数据（预留）">
        <Empty
          description="安装统计功能开发中，后续将接入埋点数据"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </Card>
    </div>
  );
};
