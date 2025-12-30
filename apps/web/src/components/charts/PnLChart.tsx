'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';

interface PnLDataPoint {
  date: string;
  pnl: number;
  cumulative: number;
}

interface PnLChartProps {
  data: PnLDataPoint[];
  height?: number;
}

// 自定义 Tooltip
interface TooltipProps {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}

const CustomTooltip = ({ active, payload, label }: TooltipProps) => {
  if (active && payload && payload.length) {
    const value = payload[0].value;
    const isPositive = value >= 0;
    return (
      <div className="bg-bg-tertiary border border-border-secondary rounded-lg p-3 shadow-lg">
        <p className="text-text-secondary text-xs mb-1">{label}</p>
        <p className={`font-bold ${isPositive ? 'text-success-400' : 'text-danger-400'}`}>
          {isPositive ? '+' : ''}{value.toFixed(2)} USDT
        </p>
      </div>
    );
  }
  return null;
};

export function PnLChart({ data, height = 300 }: PnLChartProps) {
  if (!data || data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-text-tertiary"
        style={{ height }}
      >
        暂无收益数据
      </div>
    );
  }

  // 判断整体趋势
  const lastValue = data[data.length - 1]?.cumulative || 0;
  const isPositive = lastValue >= 0;
  const gradientColor = isPositive ? '#00C087' : '#F23645';

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="pnlGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={gradientColor} stopOpacity={0.3} />
            <stop offset="95%" stopColor={gradientColor} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#2B3139" vertical={false} />
        <XAxis
          dataKey="date"
          stroke="#5E6673"
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke="#5E6673"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `${value}`}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="cumulative"
          stroke={gradientColor}
          strokeWidth={2}
          fill="url(#pnlGradient)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// 简单的迷你图表（用于卡片内）
interface MiniChartProps {
  data: number[];
  positive?: boolean;
  height?: number;
}

export function MiniPnLChart({ data, positive = true, height = 40 }: MiniChartProps) {
  const chartData = data.map((value, index) => ({ index, value }));
  const color = positive ? '#00C087' : '#F23645';

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData}>
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
