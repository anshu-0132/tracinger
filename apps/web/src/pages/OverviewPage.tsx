import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { StatusBadge } from '../components/StatusBadge';
import { SeverityBadge } from '../components/SeverityBadge';
import { MonoId } from '../components/MonoId';
import {
  DataTable,
  TableHead,
  TableHeaderCell,
  TableBody,
  TableRow,
  TableCell,
} from '../components/DataTable';
import { LoadingSkeleton, ErrorBanner } from '../components/FeedbackStates';
import {
  ShieldAlert,
  ArrowRight,
  GitCommit,
  Layers,
  ChevronRight,
} from 'lucide-react';

export const OverviewPage: React.FC = () => {
  const navigate = useNavigate();

  const {
    data: overview,
    isLoading: isOverviewLoading,
    error: overviewError,
    refetch: refetchOverview,
  } = useQuery({
    queryKey: ['overview'],
    queryFn: () => api.getOverview(),
    refetchInterval: 15000,
  });

  const {
    data: incidentsData,
  } = useQuery({
    queryKey: ['incidents-recent'],
    queryFn: () => api.getIncidents({ pageSize: 10 }),
    refetchInterval: 15000,
  });

  if (isOverviewLoading) {
    return (
      <div className="space-y-4 max-w-7xl mx-auto">
        <LoadingSkeleton rows={1} height="h-14" />
        <LoadingSkeleton rows={4} height="h-10" />
      </div>
    );
  }

  if (overviewError) {
    return (
      <ErrorBanner
        title="Telemetry overview unavailable"
        message={overviewError instanceof Error ? overviewError.message : 'Failed to query system overview'}
        onRetry={() => refetchOverview()}
      />
    );
  }

  const summary = overview?.summary || {
    totalServices: 0,
    openIncidents: 0,
    recentIncidents: 0,
    activeAlertRules: 0,
    healthy: 0,
    degraded: 0,
    unhealthy: 0,
    unknown: 0,
  };

  const services = overview?.services || [];
  const incidents = incidentsData?.data || [];

  // Sort incidents by severity weight
  const severityOrder: Record<string, number> = {
    CRITICAL: 1,
    HIGH: 2,
    MEDIUM: 3,
    LOW: 4,
    INFO: 5,
  };

  const needsAttention = incidents
    .filter((i) => i.status !== 'RESOLVED')
    .sort((a, b) => (severityOrder[a.severity] || 99) - (severityOrder[b.severity] || 99));

  // Find active P1 / CRITICAL incident
  const activeP1 = needsAttention.find((i) => i.severity === 'CRITICAL' && i.status === 'OPEN');

  const total = Math.max(1, summary.totalServices);
  const healthyPct = (summary.healthy / total) * 100;
  const degradedPct = (summary.degraded / total) * 100;
  const unhealthyPct = (summary.unhealthy / total) * 100;
  const unknownPct = (summary.unknown / total) * 100;

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* ── 1. Compact Fleet Status Strip ─────────────────────────────────── */}
      <div className="rounded-sm border border-border bg-surface p-3 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-txt-secondary">
              Fleet Status Strip
            </span>
            <span className="font-mono text-txt-muted">·</span>
            <span className="font-mono text-[11px] text-txt-primary tabular-nums font-medium">
              {summary.totalServices} microservices registered
            </span>
          </div>

          <div className="flex items-center gap-4 text-[11px] font-mono tabular-nums">
            <span className="flex items-center gap-1.5 text-[#3fb950]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#3fb950]" />
              {summary.healthy} healthy
            </span>
            <span className="flex items-center gap-1.5 text-[#d29922]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#d29922]" />
              {summary.degraded} degraded
            </span>
            <span className="flex items-center gap-1.5 text-[#f85149]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#f85149]" />
              {summary.unhealthy} unhealthy
            </span>
            <span className="text-txt-muted">
              {summary.activeAlertRules} active rules
            </span>
          </div>
        </div>

        {/* Multi-segment thin progress strip */}
        <div className="h-1.5 w-full bg-surface-raised rounded-full overflow-hidden flex gap-0.5">
          {summary.healthy > 0 && (
            <div
              style={{ width: `${healthyPct}%` }}
              className="bg-[#3fb950] transition-all"
              title={`${summary.healthy} Healthy`}
            />
          )}
          {summary.degraded > 0 && (
            <div
              style={{ width: `${degradedPct}%` }}
              className="bg-[#d29922] transition-all"
              title={`${summary.degraded} Degraded`}
            />
          )}
          {summary.unhealthy > 0 && (
            <div
              style={{ width: `${unhealthyPct}%` }}
              className="bg-[#f85149] transition-all"
              title={`${summary.unhealthy} Unhealthy`}
            />
          )}
          {summary.unknown > 0 && (
            <div
              style={{ width: `${unknownPct}%` }}
              className="bg-txt-muted transition-all"
              title={`${summary.unknown} Telemetry Absent`}
            />
          )}
        </div>
      </div>

      {/* ── 2. Prominent Active P1 Incident Callout (Calm SRE Box) ─────────── */}
      {activeP1 && (
        <div className="rounded-sm border border-[#f85149]/35 bg-[#f85149]/8 p-3.5 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded-sm bg-[#f85149] text-white font-mono text-[10px] font-bold tracking-wider uppercase">
                ACTIVE P1
              </span>
              <span className="font-mono text-xs font-semibold text-txt-primary">
                {activeP1.title}
              </span>
              <span className="font-mono text-[11px] text-txt-secondary px-1.5 py-0.2 rounded-sm bg-surface border border-border-subtle">
                {activeP1.service.name}
              </span>
            </div>

            <Link
              to={`/incidents/${activeP1.id}`}
              className="px-2.5 py-1 text-xs font-mono font-medium rounded-sm bg-surface hover:bg-surface-raised text-[#f85149] border border-[#f85149]/40 transition-colors inline-flex items-center gap-1.5"
            >
              <span>Investigate Incident</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-[11px] font-mono text-txt-secondary tabular-nums">
            {activeP1.currentValue !== undefined && activeP1.threshold !== undefined && (
              <span>
                breach: <strong className="text-[#f85149] font-normal">{activeP1.currentValue}</strong> &gt; threshold {activeP1.threshold}
              </span>
            )}
            <span>
              started: {new Date(activeP1.startedAt).toLocaleTimeString()}
            </span>
            {activeP1.correlatedDeployment && (
              <span className="inline-flex items-center gap-1 text-accent">
                <GitCommit className="w-3 h-3" />
                release {activeP1.correlatedDeployment.version}
              </span>
            )}
            <MonoId id={activeP1.fingerprint} truncateLength={12} prefix="fp:" />
          </div>
        </div>
      )}

      {/* ── 3. Dense "Needs Attention" List ─────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-3.5 h-3.5 text-txt-secondary" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-txt-secondary font-mono">
              Needs Attention ({needsAttention.length})
            </h3>
          </div>
          <Link
            to="/incidents"
            className="text-[11px] font-mono text-txt-muted hover:text-txt-primary transition-colors flex items-center gap-1"
          >
            <span>All incidents ({summary.openIncidents} open)</span>
            <ChevronRight className="w-3 h-3" />
          </Link>
        </div>

        {needsAttention.length === 0 ? (
          <div className="rounded-sm border border-border bg-surface p-4 text-center text-xs text-txt-muted font-mono">
            0 active incidents requiring attention. Fleet operating within baseline SLO thresholds.
          </div>
        ) : (
          <DataTable>
            <TableHead>
              <tr>
                <TableHeaderCell className="w-20">Severity</TableHeaderCell>
                <TableHeaderCell className="w-24">State</TableHeaderCell>
                <TableHeaderCell>Incident</TableHeaderCell>
                <TableHeaderCell className="w-36">Service</TableHeaderCell>
                <TableHeaderCell className="w-32">Metric / Breach</TableHeaderCell>
                <TableHeaderCell className="w-28">Timestamp</TableHeaderCell>
                <TableHeaderCell align="right" className="w-28">Action</TableHeaderCell>
              </tr>
            </TableHead>
            <TableBody>
              {needsAttention.map((inc) => (
                <TableRow
                  key={inc.id}
                  onClick={() => navigate(`/incidents/${inc.id}`)}
                  className="cursor-pointer"
                >
                  <TableCell>
                    <SeverityBadge severity={inc.severity} size="sm" />
                  </TableCell>
                  <TableCell>
                    <span className={`font-mono text-[10px] uppercase px-1.5 py-0.5 rounded-sm border ${
                      inc.status === 'OPEN'
                        ? 'bg-[#f85149]/10 text-[#f85149] border-[#f85149]/30'
                        : 'bg-[#d29922]/10 text-[#d29922] border-[#d29922]/30'
                    }`}>
                      {inc.status}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Link
                      to={`/incidents/${inc.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="font-medium text-xs text-txt-primary hover:text-accent truncate block"
                    >
                      {inc.title}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-[11px] text-txt-secondary px-1.5 py-0.5 rounded-sm bg-surface-raised border border-border-subtle">
                      {inc.service.name}
                    </span>
                  </TableCell>
                  <TableCell>
                    {inc.currentValue !== undefined && inc.threshold !== undefined ? (
                      <span className="font-mono text-[10px] text-[#f85149] tabular-nums">
                        {inc.currentValue} &gt; {inc.threshold}
                      </span>
                    ) : (
                      <span className="font-mono text-[10px] text-txt-muted">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-[11px] text-txt-muted tabular-nums">
                      {new Date(inc.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </TableCell>
                  <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                    <Link
                      to={`/incidents/${inc.id}`}
                      className="px-2 py-0.5 text-[11px] font-mono rounded-sm bg-surface-raised hover:bg-surface-active text-txt-primary border border-border hover:border-accent transition-colors inline-flex items-center gap-1"
                    >
                      <span>Triage</span>
                      <ArrowRight className="w-2.5 h-2.5 text-txt-muted" />
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </DataTable>
        )}
      </div>

      {/* ── 4. Service Fleet Snapshot Table ─────────────────────────────────── */}
      <div className="space-y-2 pt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-3.5 h-3.5 text-txt-secondary" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-txt-secondary font-mono">
              Monitored Service Fleet ({services.length})
            </h3>
          </div>
          <Link
            to="/services"
            className="text-[11px] font-mono text-txt-muted hover:text-txt-primary transition-colors flex items-center gap-1"
          >
            <span>Service Directory</span>
            <ChevronRight className="w-3 h-3" />
          </Link>
        </div>

        <DataTable>
          <TableHead>
            <tr>
              <TableHeaderCell className="w-24">Health</TableHeaderCell>
              <TableHeaderCell>Service Name</TableHeaderCell>
              <TableHeaderCell className="w-28">Env</TableHeaderCell>
              <TableHeaderCell align="right" className="w-28">Request Rate</TableHeaderCell>
              <TableHeaderCell align="right" className="w-28">Error Rate</TableHeaderCell>
              <TableHeaderCell align="right" className="w-28">P95 Latency</TableHeaderCell>
              <TableHeaderCell align="right" className="w-28">Incidents</TableHeaderCell>
            </tr>
          </TableHead>
          <TableBody>
            {services.map((svcHealth) => {
              const svc = svcHealth.service;
              return (
                <TableRow
                  key={svc.id}
                  onClick={() => navigate(`/services/${svc.id}`)}
                  className="cursor-pointer"
                >
                  <TableCell>
                    <StatusBadge status={svcHealth.status} size="sm" />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-xs text-txt-primary hover:text-accent">
                        {svc.name}
                      </span>
                      {svc.tags?.slice(0, 2).map((t, i) => (
                        <span key={i} className="text-[10px] font-mono text-txt-muted px-1 py-0.2 rounded-sm bg-surface-raised">
                          #{t}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-[11px] text-txt-muted">
                      {svc.environment}
                    </span>
                  </TableCell>
                  <TableCell align="right">
                    <span className="font-mono text-xs text-txt-primary tabular-nums">
                      {svcHealth.requestRate !== undefined
                        ? `${svcHealth.requestRate.toFixed(1)} req/s`
                        : '—'}
                    </span>
                  </TableCell>
                  <TableCell align="right">
                    <span
                      className={`font-mono text-xs tabular-nums ${
                        (svcHealth.errorRate ?? 0) > 0.05 ? 'text-[#f85149] font-medium' : 'text-txt-primary'
                      }`}
                    >
                      {svcHealth.errorRate !== undefined
                        ? `${(svcHealth.errorRate * 100).toFixed(2)}%`
                        : '0.00%'}
                    </span>
                  </TableCell>
                  <TableCell align="right">
                    <span className="font-mono text-xs text-txt-primary tabular-nums">
                      {svcHealth.p95Latency !== undefined
                        ? `${svcHealth.p95Latency.toFixed(0)} ms`
                        : '—'}
                    </span>
                  </TableCell>
                  <TableCell align="right">
                    <span
                      className={`font-mono text-xs tabular-nums ${
                        svcHealth.activeIncidentCount > 0 ? 'text-[#f85149] font-semibold' : 'text-txt-muted'
                      }`}
                    >
                      {svcHealth.activeIncidentCount}
                    </span>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </DataTable>
      </div>
    </div>
  );
};
