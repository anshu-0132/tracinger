import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Activity,
  Server,
  AlertCircle,
  BellRing,
  GitCommit,
  FlaskConical,
  Search,
  Settings,
  RefreshCw,
  ExternalLink,
  Clock,
  Sun,
  Moon,
  ChevronLeft,
  ChevronRight,
  Command,
} from 'lucide-react';
import { CommandPalette } from './CommandPalette';
import { StatusDot } from './StatusDot';

interface LayoutProps {
  onRefresh?: () => void;
  isRefreshing?: boolean;
  children?: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ onRefresh, isRefreshing = false, children }) => {
  const [timeRange, setTimeRange] = useState('now-1h');
  const [autoRefreshInterval, setAutoRefreshInterval] = useState('30s');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return typeof document !== 'undefined' && document.documentElement.classList.contains('light')
      ? 'light'
      : 'dark';
  });
  const location = useLocation();

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    if (nextTheme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
  };

  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, []);

  const navItems = [
    { to: '/', label: 'Overview', icon: Activity, exact: true },
    { to: '/services', label: 'Services', icon: Server },
    { to: '/incidents', label: 'Incidents', icon: AlertCircle },
    { to: '/alert-rules', label: 'Alert Rules & SLOs', icon: BellRing },
    { to: '/deployments', label: 'Deployments', icon: GitCommit },
    { to: '/replay-lab', label: 'Replay Lab', icon: FlaskConical },
    { to: '/explorer', label: 'Explorer', icon: Search },
    { to: '/settings', label: 'Settings', icon: Settings },
  ];

  const getBreadcrumb = () => {
    const path = location.pathname;
    if (path === '/') return 'System Overview';
    if (path.startsWith('/services/')) return 'Services / Detail';
    if (path === '/services') return 'Service Directory';
    if (path.startsWith('/incidents/')) return 'Incidents / Investigation';
    if (path === '/incidents') return 'Incidents';
    if (path === '/alert-rules') return 'Alert Rules & SLOs';
    if (path === '/deployments') return 'Deployments';
    if (path === '/replay-lab') return 'Incident Replay Lab';
    if (path === '/explorer') return 'Telemetry Explorer';
    if (path === '/settings') return 'Settings & Probes';
    return 'Tracinger';
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-canvas text-txt-primary">
      {/* ── Slim Left Sidebar ─────────────────────────────────────────────── */}
      <aside
        className={`${
          isSidebarCollapsed ? 'w-14' : 'w-56'
        } border-r border-border bg-surface flex flex-col shrink-0 select-none transition-all duration-150`}
      >
        {/* Brand Header */}
        <div className="h-12 flex items-center justify-between px-3.5 border-b border-border">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-5 h-5 rounded-sm bg-accent flex items-center justify-center shrink-0">
              <Activity className="w-3.5 h-3.5 text-white" />
            </div>
            {!isSidebarCollapsed && (
              <div className="min-w-0">
                <span className="font-semibold text-xs tracking-tight text-txt-primary block leading-none">
                  Tracinger
                </span>
                <span className="text-[10px] text-txt-muted font-mono leading-none tracking-tight">
                  v1.4.2
                </span>
              </div>
            )}
          </div>
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="p-1 rounded-sm text-txt-muted hover:text-txt-primary hover:bg-surface-raised transition-colors cursor-pointer"
            title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isSidebarCollapsed ? (
              <ChevronRight className="w-3.5 h-3.5" />
            ) : (
              <ChevronLeft className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.exact
              ? location.pathname === item.to
              : location.pathname.startsWith(item.to);

            return (
              <NavLink
                key={item.to}
                to={item.to}
                title={item.label}
                className={`relative flex items-center gap-2.5 px-2.5 py-1.5 rounded-sm text-xs transition-colors ${
                  isActive
                    ? 'bg-surface-raised text-txt-primary font-medium before:absolute before:left-0 before:top-1 before:bottom-1 before:w-0.5 before:bg-accent'
                    : 'text-txt-secondary hover:bg-surface-raised/70 hover:text-txt-primary'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? 'text-accent' : 'text-txt-muted'
                  }`}
                />
                {!isSidebarCollapsed && (
                  <span className="truncate">{item.label}</span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Direct Backends Quick Links */}
        {!isSidebarCollapsed && (
          <div className="p-2.5 border-t border-border-subtle bg-surface-raised/30 space-y-1.5">
            <span className="text-[10px] font-mono uppercase tracking-wider text-txt-muted px-1.5 block">
              Backends
            </span>
            <div className="grid grid-cols-2 gap-1 px-1">
              <a
                href="http://localhost:3000"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between px-2 py-1 rounded-sm bg-surface text-[11px] font-mono text-txt-secondary hover:text-txt-primary border border-border-subtle hover:border-border transition-colors"
              >
                <span>Grafana</span>
                <ExternalLink className="w-2.5 h-2.5 text-txt-muted" />
              </a>
              <a
                href="http://localhost:9090"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between px-2 py-1 rounded-sm bg-surface text-[11px] font-mono text-txt-secondary hover:text-txt-primary border border-border-subtle hover:border-border transition-colors"
              >
                <span>Prometheus</span>
                <ExternalLink className="w-2.5 h-2.5 text-txt-muted" />
              </a>
            </div>
          </div>
        )}

        {/* Status indicator footer */}
        <div className="p-2.5 border-t border-border flex items-center justify-between text-[11px] text-txt-muted font-mono">
          <div className="flex items-center gap-2">
            <StatusDot status="healthy" size="sm" pulse />
            {!isSidebarCollapsed && <span>Live Stream</span>}
          </div>
          {!isSidebarCollapsed && (
            <span className="text-[10px] text-txt-muted tabular-nums">412ms</span>
          )}
        </div>
      </aside>

      {/* ── Main Viewport ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Control Bar */}
        <header className="h-12 border-b border-border bg-surface px-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-xs font-mono text-txt-muted">tracinger</span>
            <span className="text-txt-muted">/</span>
            <span className="text-xs font-semibold text-txt-primary truncate">
              {getBreadcrumb()}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Command Palette Button */}
            <button
              onClick={() => setIsCommandPaletteOpen(true)}
              className="hidden md:flex items-center gap-2 px-2 py-1 rounded-sm border border-border bg-surface-raised hover:bg-surface-active text-txt-muted hover:text-txt-primary text-xs font-mono transition-colors cursor-pointer"
              title="Search or execute command (Cmd+K / Ctrl+K)"
            >
              <Search className="w-3.5 h-3.5 text-txt-muted" />
              <span className="text-[11px]">Search...</span>
              <kbd className="inline-flex items-center gap-0.5 text-[10px] bg-surface px-1 py-0.2 rounded border border-border-subtle text-txt-secondary">
                <Command className="w-2.5 h-2.5 inline" />K
              </kbd>
            </button>

            {/* Environment Selector */}
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-sm border border-border bg-surface text-xs font-mono text-txt-secondary">
              <span className="w-1.5 h-1.5 rounded-full bg-[#3fb950]" />
              <select
                aria-label="Target environment"
                defaultValue="production"
                className="bg-transparent border-none text-xs text-txt-primary focus:outline-none cursor-pointer pr-1"
              >
                <option value="production" className="bg-surface text-txt-primary">production</option>
                <option value="staging" className="bg-surface text-txt-primary">staging</option>
              </select>
            </div>

            {/* Time Range Selector */}
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-sm border border-border bg-surface text-xs text-txt-secondary">
              <Clock className="w-3.5 h-3.5 text-txt-muted" />
              <select
                aria-label="Time range"
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="bg-transparent border-none text-xs text-txt-primary focus:outline-none cursor-pointer pr-1"
              >
                <option value="now-15m" className="bg-surface text-txt-primary">Last 15m</option>
                <option value="now-1h" className="bg-surface text-txt-primary">Last 1h</option>
                <option value="now-6h" className="bg-surface text-txt-primary">Last 6h</option>
                <option value="now-24h" className="bg-surface text-txt-primary">Last 24h</option>
              </select>
            </div>

            {/* Auto Refresh Interval */}
            <div className="flex items-center gap-1 px-2 py-1 rounded-sm border border-border bg-surface text-xs text-txt-secondary">
              <span className="text-[10px] font-mono text-txt-muted">Auto:</span>
              <select
                aria-label="Auto refresh interval"
                value={autoRefreshInterval}
                onChange={(e) => setAutoRefreshInterval(e.target.value)}
                className="bg-transparent border-none text-xs text-txt-primary focus:outline-none cursor-pointer pr-1"
              >
                <option value="off" className="bg-surface text-txt-primary">Off</option>
                <option value="10s" className="bg-surface text-txt-primary">10s</option>
                <option value="30s" className="bg-surface text-txt-primary">30s</option>
                <option value="1m" className="bg-surface text-txt-primary">1m</option>
              </select>
            </div>

            {/* Theme Toggle (Dark / Light) */}
            <button
              onClick={toggleTheme}
              className="p-1.5 rounded-sm border border-border bg-surface hover:bg-surface-raised text-txt-secondary hover:text-txt-primary transition-colors cursor-pointer"
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? (
                <Sun className="w-3.5 h-3.5 text-txt-muted hover:text-txt-primary" />
              ) : (
                <Moon className="w-3.5 h-3.5 text-txt-muted hover:text-txt-primary" />
              )}
            </button>

            {/* Manual Refresh Button */}
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-surface-raised hover:bg-surface-active text-xs font-medium text-txt-primary border border-border hover:border-accent transition-colors cursor-pointer"
              title="Manual telemetry refresh"
              aria-label="Manual telemetry refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-accent' : 'text-txt-secondary'}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </header>

        {/* Viewport Content */}
        <main className="flex-1 overflow-y-auto p-5">
          {children || <Outlet />}
        </main>
      </div>

      {/* Global Command Palette */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
      />
    </div>
  );
};
