import { memo } from 'react';

interface SparklineProps {
  data: Array<{ week: string; activity: number }>;
  width?: number;
  height?: number;
  color?: string;
}

/**
 * Lightweight SVG-based sparkline component.
 * Much more performant than Recharts AreaChart for table cells.
 * Renders a simple polyline with gradient fill.
 */
export const Sparkline = memo(function Sparkline({
  data,
  width = 80,
  height = 28,
  color = '#FC5928',
}: SparklineProps) {
  const hasActivity = data.some(d => d.activity > 0);
  
  if (!hasActivity) {
    return (
      <div className="engagement-sparkline">
        <span className="sparkline-empty">—</span>
      </div>
    );
  }
  
  // Calculate SVG path
  const values = data.map(d => d.activity);
  const max = Math.max(...values, 1); // Avoid division by zero
  const min = 0;
  const range = max - min || 1;
  
  // Generate points for the polyline
  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * width;
    const y = height - ((value - min) / range) * (height - 4) - 2; // 2px padding
    return `${x},${y}`;
  }).join(' ');
  
  // Generate path for the filled area
  const areaPath = [
    `M 0,${height}`, // Start at bottom-left
    ...values.map((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const y = height - ((value - min) / range) * (height - 4) - 2;
      return `L ${x},${y}`;
    }),
    `L ${width},${height}`, // End at bottom-right
    'Z', // Close path
  ].join(' ');
  
  // Generate unique gradient ID to avoid conflicts
  const gradientId = `spark-${Math.random().toString(36).slice(2, 9)}`;
  
  return (
    <div className="engagement-sparkline">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.6} />
            <stop offset="100%" stopColor={color} stopOpacity={0.1} />
          </linearGradient>
        </defs>
        <path
          d={areaPath}
          fill={`url(#${gradientId})`}
        />
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
});

export default Sparkline;
