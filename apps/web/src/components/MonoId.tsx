import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface MonoIdProps {
  id: string;
  truncateLength?: number;
  prefix?: string;
  className?: string;
}

export const MonoId: React.FC<MonoIdProps> = ({
  id,
  truncateLength = 16,
  prefix = '',
  className = '',
}) => {
  const [copied, setCopied] = useState(false);

  const display =
    id.length > truncateLength
      ? `${id.slice(0, Math.ceil(truncateLength / 2))}…${id.slice(-Math.floor(truncateLength / 2))}`
      : id;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={`Click to copy: ${id}`}
      className={`group inline-flex items-center gap-1 font-mono text-[11px] text-txt-secondary hover:text-txt-primary px-1.5 py-0.5 rounded-sm bg-surface-raised border border-border-subtle hover:border-border transition-colors tabular-nums cursor-pointer ${className}`}
    >
      {prefix && <span className="text-txt-muted">{prefix}</span>}
      <span>{display}</span>
      {copied ? (
        <Check className="w-3 h-3 text-[#3fb950] shrink-0" />
      ) : (
        <Copy className="w-3 h-3 text-txt-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
      )}
    </button>
  );
};
