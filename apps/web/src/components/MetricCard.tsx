import React from 'react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  onClick?: () => void;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  trend,
  icon,
  badge,
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      className={`rounded-sm p-3.5 border border-border bg-surface transition-colors ${
        onClick ? 'cursor-pointer hover:bg-surface-raised' : ''
      }`}
    >
      <div className="flex items-center justify-between text-txt-secondary mb-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-txt-secondary font-mono">
          {title}
        </span>
        <div className="flex items-center gap-1.5">
          {badge}
          {icon && <div className="text-txt-muted">{icon}</div>}
        </div>
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xl font-bold tracking-tight text-txt-primary font-mono tabular-nums">
          {value}
        </span>
        {trend && (
          <span
            className={`text-[11px] font-medium font-mono tabular-nums px-1.5 py-0.5 rounded-sm border ${
              trend.isPositive
                ? 'text-[#3fb950] bg-[#3fb950]/10 border-[#3fb950]/25'
                : 'text-[#f85149] bg-[#f85149]/10 border-[#f85149]/25'
            }`}
          >
            {trend.value}
          </span>
        )}
      </div>
      {subtitle && (
        <p className="mt-1 text-[11px] text-txt-muted truncate">{subtitle}</p>
      )}
    </div>
  );
};
