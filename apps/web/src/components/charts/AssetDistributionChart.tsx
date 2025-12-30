'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface AssetData {
  name: string;
  value: number;
  color: string;
}

interface AssetDistributionChartProps {
  data: AssetData[];
}

const COLORS = ['#3772FF', '#00C087', '#F7931A', '#F23645', '#848E9C'];

export function AssetDistributionChart({ data }: AssetDistributionChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  if (total === 0) {
    return (
      <div className="h-[200px] flex items-center justify-center text-text-tertiary">
        暂无资产数据
      </div>
    );
  }

  // 转换为 recharts 兼容格式
  const chartData = data.map((item) => ({
    name: item.name,
    value: item.value,
    color: item.color,
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={80}
          paddingAngle={2}
          dataKey="value"
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: '#1E222D',
            border: '1px solid #2B3139',
            borderRadius: '8px',
          }}
          formatter={(value) => {
            const numValue = typeof value === 'number' ? value : 0;
            return [`$${numValue.toFixed(2)} (${((numValue / total) * 100).toFixed(1)}%)`];
          }}
        />
        <Legend
          verticalAlign="middle"
          align="right"
          layout="vertical"
          formatter={(value) => (
            <span style={{ color: '#848E9C', fontSize: '12px' }}>{value}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
