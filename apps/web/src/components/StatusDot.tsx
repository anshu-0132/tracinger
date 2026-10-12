import React from 'react';

interface StatusDotProps {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  pulse?: boolean;
  className?: string;
  size?: 'sm' | 'md';
}

export const StatusDot: React.FC<StatusDotProps> = ({
  status,
  pulse = false,
  className = '',
  size = 'md',
}) => {
  const dotColor = {
    healthy: 'bg-[#3fb950]',
    degraded: 'bg-[#d29922]',
    unhealthy: 'bg-[#f85149]',
    unknown: 'bg-[#8b949e]',
  }[status] || 'bg-[#8b949e]';

  const dotSize = size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2';

  return (
    <span
      className={`inline-block rounded-full shrink-0 ${dotSize} ${dotColor} ${
        pulse && status === 'unhealthy' ? 'animate-pulse' : ''
      } ${className}`}
      aria-label={`Status: ${status}`}
    />
  );
};
