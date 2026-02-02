/**
 * 区块卡片组件 - 用于包装各个功能区块
 */
import { Card } from 'antd';
import type { ReactNode, CSSProperties } from 'react';
import { cardStyle, cardHeadStyle } from '../constants/styles';

interface SectionCardProps {
  title: string;
  icon?: ReactNode;
  extra?: ReactNode;
  children: ReactNode;
  style?: CSSProperties;
}

export default function SectionCard({
  title,
  icon,
  extra,
  children,
  style,
}: SectionCardProps) {
  return (
    <Card
      style={{ ...cardStyle, ...style }}
      title={
        <span style={{ color: '#fff' }}>
          {icon && <span style={{ marginRight: 8 }}>{icon}</span>}
          {title}
        </span>
      }
      extra={extra}
      styles={{ header: cardHeadStyle }}
    >
      {children}
    </Card>
  );
}
