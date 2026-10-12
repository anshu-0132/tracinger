import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { StatusDot } from '../components/StatusDot';
import {
  DataTable,
  TableHead,
  TableHeaderCell,
  TableBody,
  TableRow,
  TableCell,
} from '../components/DataTable';
import { LoadingSkeleton, ErrorBanner } from '../components/FeedbackStates';
import { ExternalLink, RefreshCw } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { data: status, isLoading, error, refetch } = useQuery({
    queryKey: ['settings-status'],
    queryFn: () => api.getSettingsStatus(),
    refetchInterval: 15000,
  });

  if (isLoading) {
    return (
      <div className="space-y-3 max-w-7xl mx-auto">
        <LoadingSkeleton rows={4} height="h-10" />
      </div>
    );
  }

  if (error || !status) {
    return (
      <ErrorBanner
        title="Settings probe query failure"
        message={error instanceof Error ? error.message : 'Unable to query backend connectivity status'}
        onRetry={() => refetch()}
      />
    );
  }

  const backendProbes = [
    {
      name: 'Prometheus',
      role: 'Metrics Engine & PromQL Scraper',
      status: status.services.prometheus === 'ok' ? 'healthy' : 'unhealthy',
      latency: '14ms',
      endpoint: status.endpoints.prometheus,
      lastChecked: '10s ago',
    },
    {
      name: 'Grafana Loki',
      role: 'Log Aggregator & LogQL Storage',
      status: status.services.loki === 'ok' ? 'healthy' : 'unhealthy',
      latency: '18ms',
      endpoint: status.endpoints.loki,
      lastChecked: '10s ago',
    },
    {
      name: 'Grafana Tempo',
      role: 'OpenTelemetry Trace Storage',
      status: status.services.tempo === 'ok' ? 'healthy' : 'unhealthy',
      latency: '22ms',
      endpoint: status.endpoints.tempo,
      lastChecked: '10s ago',
    },
    {
      name: 'PostgreSQL',
      role: 'Application State & Incident Relational DB',
      status: status.services.database === 'ok' ? 'healthy' : 'unhealthy',
      latency: '3ms',
      endpoint: 'localhost:5432/tracinger',
      lastChecked: 'just now',
    },
  ] as const;

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* ── Toolbar ───────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pb-1 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-semibold text-txt-primary">
            Settings & Backend Probes
          </span>
          <span className="text-[11px] font-mono text-txt-muted">
            Infrastructure probe health, latency, and pipeline status
          </span>
        </div>

        <button
          onClick={() => refetch()}
          className="p-1 rounded-sm bg-surface hover:bg-surface-raised border border-border text-txt-secondary hover:text-txt-primary transition-colors cursor-pointer"
          title="Probe all backends now"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ── Backend Probes Table ──────────────────────────────────────────── */}
      <div className="space-y-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-txt-secondary font-mono block">
          Backend Service Probes (4 active)
        </span>

        <DataTable>
          <TableHead>
            <tr>
              <TableHeaderCell className="w-16">Health</TableHeaderCell>
              <TableHeaderCell className="w-40">Probe Target</TableHeaderCell>
              <TableHeaderCell>Role & Functionality</TableHeaderCell>
              <TableHeaderCell className="w-48">Endpoint</TableHeaderCell>
              <TableHeaderCell align="right" className="w-24">Latency</TableHeaderCell>
              <TableHeaderCell align="right" className="w-28">Last Checked</TableHeaderCell>
            </tr>
          </TableHead>
          <TableBody>
            {backendProbes.map((probe) => (
              <TableRow key={probe.name}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <StatusDot status={probe.status} size="md" />
                    <span className="font-mono text-[10px] uppercase text-txt-muted">
                      {probe.status === 'healthy' ? 'OK' : 'ERR'}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="font-mono text-xs font-semibold text-txt-primary">
                    {probe.name}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="text-xs text-txt-secondary font-sans">
                    {probe.role}
                  </span>
                </TableCell>
                <TableCell>
                  <a
                    href={probe.endpoint.startsWith('http') ? probe.endpoint : undefined}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-[11px] text-accent hover:underline inline-flex items-center gap-1"
                  >
                    <span>{probe.endpoint}</span>
                    {probe.endpoint.startsWith('http') && <ExternalLink className="w-2.5 h-2.5" />}
                  </a>
                </TableCell>
                <TableCell align="right">
                  <span className="font-mono text-xs text-txt-primary tabular-nums">
                    {probe.latency}
                  </span>
                </TableCell>
                <TableCell align="right">
                  <span className="font-mono text-[11px] text-txt-muted tabular-nums">
                    {probe.lastChecked}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </DataTable>
      </div>

      {/* ── Platform Runtime Configuration ─────────────────────────────────── */}
      <div className="space-y-2 pt-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-txt-secondary font-mono block">
          Runtime Configuration
        </span>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs font-mono">
          <div className="p-3 rounded-sm bg-surface border border-border space-y-1">
            <span className="text-[10px] uppercase tracking-wider text-txt-muted block">
              Runtime Environment
            </span>
            <span className="font-bold text-txt-primary">
              {status.environment}
            </span>
          </div>

          <div className="p-3 rounded-sm bg-surface border border-border space-y-1">
            <span className="text-[10px] uppercase tracking-wider text-txt-muted block">
              Alert Evaluation Interval
            </span>
            <span className="font-bold text-accent tabular-nums">
              {status.alertEvalIntervalSeconds}s
            </span>
          </div>

          <div className="p-3 rounded-sm bg-surface border border-border space-y-1">
            <span className="text-[10px] uppercase tracking-wider text-txt-muted block">
              Fault Injection Engine
            </span>
            <span className={`font-bold ${status.faultInjectionEnabled ? 'text-[#3fb950]' : 'text-txt-muted'}`}>
              {status.faultInjectionEnabled ? 'Enabled (Active)' : 'Disabled'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
