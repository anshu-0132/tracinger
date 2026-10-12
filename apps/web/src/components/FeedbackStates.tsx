import React from 'react';
import { AlertTriangle, Inbox, RefreshCw } from 'lucide-react';

export const LoadingSkeleton: React.FC<{ rows?: number; height?: string }> = ({
  rows = 3,
  height = 'h-10',
}) => {
  return (
    <div className="space-y-2 animate-pulse" role="status" aria-label="Loading content">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={`bg-surface-raised border border-border-subtle rounded-sm ${height} w-full`} />
      ))}
    </div>
  );
};

export const ErrorBanner: React.FC<{
  title?: string;
  message: string;
  onRetry?: () => void;
}> = ({ title = 'Failed to load telemetry', message, onRetry }) => {
  return (
    <div
      role="alert"
      className="rounded-sm border border-[#f85149]/35 bg-[#f85149]/10 p-3.5 text-[#f85149] flex items-start gap-3 my-3"
    >
      <AlertTriangle className="w-4 h-4 text-[#f85149] shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-[#f85149] text-xs">{title}</h4>
        <p className="text-[11px] text-txt-secondary mt-0.5">{message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-surface-raised hover:bg-surface-active text-txt-primary rounded-sm border border-border transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3 h-3 text-txt-secondary" />
            Retry query
          </button>
        )}
      </div>
    </div>
  );
};

export const EmptyState: React.FC<{
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  icon?: React.ReactNode;
}> = ({ title, description, action, icon }) => {
  return (
    <div className="rounded-sm border border-dashed border-border bg-surface/50 p-8 text-center flex flex-col items-center justify-center my-3">
      <div className="w-8 h-8 rounded-sm bg-surface-raised border border-border-subtle flex items-center justify-center text-txt-muted mb-2.5">
        {icon || <Inbox className="w-4 h-4" />}
      </div>
      <h4 className="font-medium text-txt-primary text-xs">{title}</h4>
      <p className="text-[11px] text-txt-secondary max-w-sm mt-0.5">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-3 px-3 py-1 text-xs font-medium bg-surface-raised hover:bg-surface-active text-txt-primary rounded-sm border border-border hover:border-accent transition-colors cursor-pointer"
        >
          {action.label}
        </button>
      )}
    </div>
  );
};
