import React from 'react';

interface StatusBadgeProps {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'md',
  showLabel = true,
}) => {
  const configs = {
    healthy: {
      bg: 'bg-[#3fb950]/10 text-[#3fb950] border-[#3fb950]/30',
      dot: 'bg-[#3fb950]',
      label: 'Healthy',
    },
    degraded: {
      bg: 'bg-[#d29922]/10 text-[#d29922] border-[#d29922]/30',
      dot: 'bg-[#d29922]',
      label: 'Degraded',
    },
    unhealthy: {
      bg: 'bg-[#f85149]/10 text-[#f85149] border-[#f85149]/35',
      dot: 'bg-[#f85149]',
      label: 'Unhealthy',
    },
    unknown: {
      bg: 'bg-[#8b949e]/10 text-[#8b949e] border-[#8b949e]/25',
      dot: 'bg-[#8b949e]',
      label: 'Unknown',
    },
  };

  const config = configs[status] || configs.unknown;

  const sizeClasses = {
    sm: 'text-[11px] px-1.5 py-0.5 gap-1.5',
    md: 'text-xs px-2 py-0.5 gap-1.5 font-medium',
    lg: 'text-xs px-2.5 py-1 gap-2 font-medium',
  };

  const dotSizes = {
    sm: 'w-1.5 h-1.5',
    md: 'w-1.5 h-1.5',
    lg: 'w-2 h-2',
  };

  return (
    <span
      className={`inline-flex items-center rounded-sm border ${config.bg} ${sizeClasses[size]}`}
    >
      <span className={`rounded-full shrink-0 ${config.dot} ${dotSizes[size]}`} />
      {showLabel && <span>{config.label}</span>}
    </span>
  );
};
