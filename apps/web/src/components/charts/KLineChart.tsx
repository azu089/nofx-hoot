'use client';

import { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, CrosshairMode, LineStyle } from 'lightweight-charts';
import type { IChartApi, UTCTimestamp, SeriesMarker, Time } from 'lightweight-charts';

// K 线数据点
export interface KLineDataPoint {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

// 交易标记（买卖点）
export interface TradeMarker {
  time: UTCTimestamp;
  position: 'aboveBar' | 'belowBar';
  color: string;
  shape: 'arrowUp' | 'arrowDown' | 'circle';
  text: string;
  size?: number;
}

// 组件属性
interface KLineChartProps {
  data: KLineDataPoint[];
  markers?: TradeMarker[];
  height?: number;
  timeframe?: '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
  showVolume?: boolean;
  onTimeframeChange?: (tf: string) => void;
}

// 时间框架选项
const TIMEFRAMES = [
  { value: '1m', label: '1分' },
  { value: '5m', label: '5分' },
  { value: '15m', label: '15分' },
  { value: '1h', label: '1时' },
  { value: '4h', label: '4时' },
  { value: '1d', label: '1天' },
];

export function KLineChart({
  data,
  markers = [],
  height = 400,
  timeframe = '1h',
  showVolume = true,
  onTimeframeChange,
}: KLineChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const candlestickSeriesRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const volumeSeriesRef = useRef<any>(null);
  const [selectedTimeframe, setSelectedTimeframe] = useState(timeframe);

  // 初始化图表
  useEffect(() => {
    if (!chartContainerRef.current) return;

    // 创建图表
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: height,
      layout: {
        background: { type: ColorType.Solid, color: '#0B0E11' },
        textColor: '#848E9C',
      },
      grid: {
        vertLines: { color: '#1E222D' },
        horzLines: { color: '#1E222D' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: '#3772FF',
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: '#3772FF',
        },
        horzLine: {
          color: '#3772FF',
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: '#3772FF',
        },
      },
      rightPriceScale: {
        borderColor: '#2B3139',
        scaleMargins: {
          top: 0.1,
          bottom: showVolume ? 0.25 : 0.1,
        },
      },
      timeScale: {
        borderColor: '#2B3139',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    chartRef.current = chart;

    // 添加 K 线系列 - lightweight-charts v5 API
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const candlestickSeries = (chart as any).addCandlestickSeries({
      upColor: '#00C087',
      downColor: '#F23645',
      borderUpColor: '#00C087',
      borderDownColor: '#F23645',
      wickUpColor: '#00C087',
      wickDownColor: '#F23645',
    });
    candlestickSeriesRef.current = candlestickSeries;

    // 添加成交量系列
    if (showVolume) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const volumeSeries = (chart as any).addHistogramSeries({
        color: '#3772FF',
        priceFormat: {
          type: 'volume',
        },
        priceScaleId: 'volume',
      });

      chart.priceScale('volume').applyOptions({
        scaleMargins: {
          top: 0.8,
          bottom: 0,
        },
      });

      volumeSeriesRef.current = volumeSeries;
    }

    // 响应式调整
    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [height, showVolume]);

  // 更新数据
  useEffect(() => {
    if (!candlestickSeriesRef.current || !data.length) return;

    // 设置 K 线数据
    candlestickSeriesRef.current.setData(data);

    // 设置成交量数据
    if (volumeSeriesRef.current && showVolume) {
      const volumeData = data.map((d) => ({
        time: d.time,
        value: d.volume || 0,
        color: d.close >= d.open ? 'rgba(0, 192, 135, 0.5)' : 'rgba(242, 54, 69, 0.5)',
      }));
      volumeSeriesRef.current.setData(volumeData);
    }

    // 设置买卖点标记
    if (markers.length > 0 && candlestickSeriesRef.current.setMarkers) {
      const seriesMarkers: SeriesMarker<Time>[] = markers.map((m) => ({
        time: m.time as Time,
        position: m.position,
        color: m.color,
        shape: m.shape,
        text: m.text,
        size: m.size || 1,
      }));
      candlestickSeriesRef.current.setMarkers(seriesMarkers);
    }

    // 自动滚动到最新
    chartRef.current?.timeScale().fitContent();
  }, [data, markers, showVolume]);

  // 时间框架切换
  const handleTimeframeChange = (tf: string) => {
    setSelectedTimeframe(tf as typeof selectedTimeframe);
    onTimeframeChange?.(tf);
  };

  return (
    <div className="w-full">
      {/* 时间框架选择器 */}
      <div className="flex items-center gap-1 mb-2 px-2">
        {TIMEFRAMES.map((tf) => (
          <button
            key={tf.value}
            onClick={() => handleTimeframeChange(tf.value)}
            className={`px-3 py-1 text-sm rounded-sm transition-colors ${
              selectedTimeframe === tf.value
                ? 'bg-brand-primary text-white'
                : 'bg-bg-tertiary text-text-secondary hover:bg-bg-secondary hover:text-text-primary'
            }`}
          >
            {tf.label}
          </button>
        ))}
      </div>

      {/* 图表容器 */}
      <div
        ref={chartContainerRef}
        className="w-full rounded-md overflow-hidden"
        style={{ height: `${height}px` }}
      />

      {/* 空数据提示 */}
      {data.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-bg-primary/80">
          <p className="text-text-secondary">暂无 K 线数据</p>
        </div>
      )}
    </div>
  );
}

// 迷你 K 线图（用于卡片内嵌）
export function MiniKLineChart({
  data,
  height = 60,
}: {
  data: KLineDataPoint[];
  height?: number;
}) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: height,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: 'transparent',
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { visible: false },
      },
      rightPriceScale: { visible: false },
      timeScale: { visible: false },
      crosshair: { mode: CrosshairMode.Hidden },
      handleScale: false,
      handleScroll: false,
    });

    chartRef.current = chart;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const candlestickSeries = (chart as any).addCandlestickSeries({
      upColor: '#00C087',
      downColor: '#F23645',
      borderUpColor: '#00C087',
      borderDownColor: '#F23645',
      wickUpColor: '#00C087',
      wickDownColor: '#F23645',
    });

    if (data.length > 0) {
      candlestickSeries.setData(data);
      chart.timeScale().fitContent();
    }

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [data, height]);

  return (
    <div
      ref={chartContainerRef}
      className="w-full"
      style={{ height: `${height}px` }}
    />
  );
}

export default KLineChart;
