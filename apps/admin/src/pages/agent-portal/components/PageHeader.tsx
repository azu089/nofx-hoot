/**
 * 页面标题组件
 */
import { Typography, Space } from 'antd';
import type { ReactNode } from 'react';

const { Title } = Typography;

interface PageHeaderProps {
  title: string;
  icon?: ReactNode;
  extra?: ReactNode;
}

export default function PageHeader({ title, icon, extra }: PageHeaderProps) {
  return (
    <div
      style={{
        marginBottom: 24,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <Title level={4} style={{ color: '#fff', margin: 0 }}>
        {icon && <span style={{ marginRight: 8 }}>{icon}</span>}
        {title}
      </Title>
      {extra && <Space>{extra}</Space>}
    </div>
  );
}
