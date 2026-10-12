import React from 'react';
import type { AlertSeverity } from '@tracinger/shared';

interface SeverityBadgeProps {
  severity: AlertSeverity;
  size?: 'sm' | 'md';
}

export const SeverityBadge: React.FC<SeverityBadgeProps> = ({ severity, size = 'md' }) => {
  const configs: Record<AlertSeverity, { bg: string; text: string; border: string }> = {
    CRITICAL: {
      bg: 'bg-[#f85149]/12',
      text: 'text-[#f85149] font-medium',
      border: 'border-[#f85149]/35',
    },
    HIGH: {
      bg: 'bg-[#d29922]/12',
      text: 'text-[#d29922] font-medium',
      border: 'border-[#d29922]/35',
    },
    MEDIUM: {
      bg: 'bg-[#d29922]/10',
      text: 'text-[#d29922] font-medium',
      border: 'border-[#d29922]/25',
    },
    LOW: {
      bg: 'bg-[#3fb950]/10',
      text: 'text-[#3fb950] font-medium',
      border: 'border-[#3fb950]/25',
    },
    INFO: {
      bg: 'bg-[#58a6ff]/10',
      text: 'text-[#58a6ff] font-medium',
      border: 'border-[#58a6ff]/25',
    },
  };

  const config = configs[severity] || configs.INFO;
  const padding = size === 'sm' ? 'px-1.5 py-0.2 text-[10px]' : 'px-2 py-0.5 text-[11px]';

  return (
    <span
      className={`inline-flex items-center rounded-sm border uppercase font-mono tracking-wider tabular-nums ${config.bg} ${config.text} ${config.border} ${padding}`}
    >
      {severity}
    </span>
  );
};
