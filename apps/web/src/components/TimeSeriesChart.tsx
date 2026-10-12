import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ReferenceLine,
} from 'recharts';

export interface SeriesConfig {
  key: string;
  name: string;
  color: string;
  strokeDasharray?: string;
}

export interface ReferenceLineConfig {
  x: string;
  label?: string;
  color?: string;
}

interface TimeSeriesChartProps {
  data: Array<Record<string, any>>;
  series: SeriesConfig[];
  unit?: string;
  height?: number;
  title?: string;
  emptyMessage?: string;
  referenceLines?: ReferenceLineConfig[];
}

export const TimeSeriesChart: React.FC<TimeSeriesChartProps> = ({
  data,
  series,
  unit = '',
  height = 220,
  title,
  emptyMessage = 'No telemetry points available for selected time window',
  referenceLines = [],
}) => {
  if (!data || data.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center rounded-sm border border-border bg-surface text-txt-muted text-xs p-5"
        style={{ height }}
      >
        {title && <span className="font-medium text-txt-secondary mb-1">{title}</span>}
        <span>{emptyMessage}</span>
      </div>
    );
  }

  const formatTime = (ts: string) => {
    try {
      const d = new Date(ts);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return ts;
    }
  };

  const formatValue = (val: number) => {
    if (typeof val !== 'number' || isNaN(val)) return '0';
    if (unit === '%') return `${(val * 100).toFixed(1)}%`;
    if (val >= 1000) return `${(val / 1000).toFixed(1)}k`;
    return `${val.toFixed(val < 10 && val % 1 !== 0 ? 2 : 0)}${unit}`;
  };

  return (
    <div className="rounded-sm border border-border bg-surface p-3.5">
      {title && (
        <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-border-subtle">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-txt-secondary font-mono">
            {title}
          </h4>
        </div>
      )}
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 6, right: 12, left: -14, bottom: 0 }}>
            <CartesianGrid strokeDasharray="2 2" stroke="var(--border-subtle, #1c2027)" vertical={false} />
            <XAxis
              dataKey="timestamp"
              tickFormatter={formatTime}
              stroke="var(--text-muted, #57606a)"
              fontSize={10}
              tickLine={false}
              axisLine={{ stroke: 'var(--border-subtle, #1c2027)' }}
              tick={{ fill: 'var(--text-muted, #8b949e)' }}
            />
            <YAxis
              tickFormatter={formatValue}
              stroke="var(--text-muted, #57606a)"
              fontSize={10}
              tickLine={false}
              axisLine={{ stroke: 'var(--border-subtle, #1c2027)' }}
              tick={{ fill: 'var(--text-muted, #8b949e)' }}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div className="rounded-sm border border-border bg-surface-raised p-2 shadow-lg text-[11px] font-mono tabular-nums">
                    <p className="text-txt-muted text-[10px] mb-1 pb-0.5 border-b border-border-subtle">
                      {label ? new Date(label).toLocaleTimeString() : ''}
                    </p>
                    {payload.map((entry: any, index: number) => (
                      <div
                        key={`item-${index}`}
                        className="flex items-center justify-between gap-3 py-0.5"
                      >
                        <span className="flex items-center gap-1.5 text-txt-secondary">
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: entry.color }}
                          />
                          {entry.name}:
                        </span>
                        <span className="font-semibold text-txt-primary">
                          {formatValue(entry.value)}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              }}
            />
            <Legend
              verticalAlign="top"
              align="right"
              wrapperStyle={{ paddingBottom: '6px', fontSize: '10px' }}
            />
            {referenceLines.map((ref, idx) => (
              <ReferenceLine
                key={`ref-${idx}`}
                x={ref.x}
                stroke={ref.color || 'var(--status-unhealthy-text, #f85149)'}
                strokeDasharray="3 3"
                strokeWidth={1.5}
                label={{
                  value: ref.label || 'Deployment',
                  fill: ref.color || 'var(--status-unhealthy-text, #f85149)',
                  fontSize: 10,
                  position: 'top',
                }}
              />
            ))}
            {series.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.name}
                stroke={s.color}
                strokeWidth={1.5}
                dot={false}
                strokeDasharray={s.strokeDasharray}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
