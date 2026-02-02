/**
 * 统计卡片组件
 */
import { Card, Statistic } from 'antd';
import type { ReactNode, CSSProperties } from 'react';
import { gradientStyles, cardStyle } from '../constants/styles';

type GradientType = keyof typeof gradientStyles | 'default';

interface StatCardProps {
  title: string;
  value: number | string;
  precision?: number;
  prefix?: ReactNode;
  suffix?: string;
  gradient?: GradientType;
  valueColor?: string;
  size?: 'default' | 'small';
  extra?: ReactNode;
}

export default function StatCard({
  title,
  value,
  precision,
  prefix,
  suffix,
  gradient = 'default',
  valueColor,
  size = 'small',
  extra,
}: StatCardProps) {
  const isGradient = gradient !== 'default';
  const style: CSSProperties = isGradient
    ? gradientStyles[gradient as keyof typeof gradientStyles]
    : cardStyle;

  const titleStyle = {
    color: isGradient ? 'rgba(255,255,255,0.85)' : '#94a3b8',
    fontSize: 12,
  };

  const valueStyle = {
    color: valueColor || (isGradient ? '#fff' : '#fff'),
    fontWeight: 'bold' as const,
    fontSize: size === 'small' ? 20 : 24,
  };

  return (
    <Card style={style} size={size}>
      <Statistic
        title={<span style={titleStyle}>{title}</span>}
        value={value}
        precision={precision}
        prefix={prefix}
        suffix={suffix}
        valueStyle={valueStyle}
      />
      {extra}
    </Card>
  );
}
