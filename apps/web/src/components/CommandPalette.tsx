import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  Server,
  AlertCircle,
  BellRing,
  GitCommit,
  FlaskConical,
  Search,
  Settings,
  X,
} from 'lucide-react';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else setQuery('');
      } else if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const items = [
    { id: 'overview', title: 'System Overview', path: '/', icon: Activity, category: 'Navigation' },
    { id: 'services', title: 'Service Directory', path: '/services', icon: Server, category: 'Navigation' },
    { id: 'incidents', title: 'Active & Historical Incidents', path: '/incidents', icon: AlertCircle, category: 'Navigation' },
    { id: 'incident-active', title: 'Investigate: High Error Rate (7.4%)', path: '/incidents/inc-p1-order-err', icon: AlertCircle, category: 'Active Incident' },
    { id: 'alert-rules', title: 'Alert Rules & SLOs', path: '/alert-rules', icon: BellRing, category: 'Navigation' },
    { id: 'deployments', title: 'Deployment Change Timeline', path: '/deployments', icon: GitCommit, category: 'Navigation' },
    { id: 'replay', title: 'Incident Replay Lab', path: '/replay-lab', icon: FlaskConical, category: 'Navigation' },
    { id: 'explorer', title: 'Telemetry Explorer (Logs & Traces)', path: '/explorer', icon: Search, category: 'Navigation' },
    { id: 'settings', title: 'Platform Settings & Backend Probes', path: '/settings', icon: Settings, category: 'Navigation' },
    { id: 'svc-order', title: 'Service: order-service', path: '/services/svc-order', icon: Server, category: 'Microservices' },
    { id: 'svc-inventory', title: 'Service: inventory-service', path: '/services/svc-inventory', icon: Server, category: 'Microservices' },
    { id: 'svc-payment', title: 'Service: payment-service', path: '/services/svc-payment', icon: Server, category: 'Microservices' },
  ];

  const filtered = items.filter((item) =>
    item.title.toLowerCase().includes(query.toLowerCase()) ||
    item.category.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelect = (path: string) => {
    navigate(path);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/60 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-surface border border-border rounded-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center px-3.5 py-2.5 border-b border-border bg-surface-raised gap-2.5">
          <Search className="w-4 h-4 text-txt-muted shrink-0" />
          <input
            autoFocus
            type="text"
            placeholder="Type a command or jump to page... (ESC to exit)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-xs text-txt-primary placeholder-txt-muted outline-none font-sans"
          />
          <button
            onClick={onClose}
            className="p-1 rounded text-txt-muted hover:text-txt-primary text-xs"
            aria-label="Close command palette"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-txt-muted">
              No matching commands or pages found.
            </div>
          ) : (
            filtered.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelect(item.path)}
                  className="w-full flex items-center justify-between px-3.5 py-2 hover:bg-surface-raised text-left transition-colors text-xs group"
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-3.5 h-3.5 text-txt-muted group-hover:text-txt-primary shrink-0" />
                    <span className="text-txt-primary font-medium">{item.title}</span>
                  </div>
                  <span className="text-[10px] uppercase font-mono text-txt-muted tracking-wider">
                    {item.category}
                  </span>
                </button>
              );
            })
          )}
        </div>

        <div className="px-3.5 py-1.5 border-t border-border bg-surface-raised flex items-center justify-between text-[10px] text-txt-muted font-mono">
          <span>Navigate with arrows or click</span>
          <span>ESC to close</span>
        </div>
      </div>
    </div>
  );
};
