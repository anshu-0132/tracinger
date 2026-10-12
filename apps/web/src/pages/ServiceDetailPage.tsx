import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { StatusBadge } from '../components/StatusBadge';
import { SeverityBadge } from '../components/SeverityBadge';
import { TimeSeriesChart } from '../components/TimeSeriesChart';
import { MonoId } from '../components/MonoId';
import {
  DataTable,
  TableHead,
  TableHeaderCell,
  TableBody,
  TableRow,
  TableCell,
} from '../components/DataTable';
import { LoadingSkeleton, ErrorBanner, EmptyState } from '../components/FeedbackStates';
import {
  Server,
  ArrowLeft,
  ExternalLink,
  Activity,
  GitCommit,
  BellRing,
  Search,
  ArrowRight,
} from 'lucide-react';

export const ServiceDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<'metrics' | 'traces' | 'rules' | 'deployments'>('metrics');

  const {
    data: service,
    isLoading: isServiceLoading,
    error: serviceError,
  } = useQuery({
    queryKey: ['service', id],
    queryFn: () => (id ? api.getService(id) : Promise.reject('No ID')),
    enabled: !!id,
    refetchInterval: 15000,
  });

  const {
    data: metrics,
    isLoading: isMetricsLoading,
  } = useQuery({
    queryKey: ['service-metrics', id],
    queryFn: () => (id ? api.getServiceMetrics(id) : Promise.reject('No ID')),
    enabled: !!id,
    refetchInterval: 15000,
  });

  const {
    data: tracesData,
    isLoading: isTracesLoading,
  } = useQuery({
    queryKey: ['service-traces', id],
    queryFn: () => (id ? api.getServiceTraces(id) : Promise.reject('No ID')),
    enabled: !!id && activeTab === 'traces',
  });

  const {
    data: rulesData,
    isLoading: isRulesLoading,
  } = useQuery({
    queryKey: ['service-rules', id],
    queryFn: () => (id ? api.getAlertRules({ serviceId: id }) : Promise.reject('No ID')),
    enabled: !!id && activeTab === 'rules',
  });

  const {
    data: deploymentsData,
    isLoading: isDeploymentsLoading,
  } = useQuery({
    queryKey: ['service-deployments', service?.name],
    queryFn: () => (service?.name ? api.getDeployments({ serviceName: service.name }) : Promise.reject('No service')),
    enabled: !!service?.name && activeTab === 'deployments',
  });

  if (isServiceLoading) {
    return <LoadingSkeleton rows={5} height="h-20" />;
  }

  if (serviceError || !service) {
    return (
      <ErrorBanner
        title="Failed to load service"
        message={serviceError instanceof Error ? serviceError.message : 'Service record not found'}
      />
    );
  }

  const p50Points = metrics?.p50Latency || [];
  const p95Points = metrics?.p95Latency || [];
  const p99Points = metrics?.p99Latency || [];

  const latencyChartData = p95Points.map((p, idx) => ({
    timestamp: p.timestamp,
    p95: p.value,
    p50: p50Points[idx]?.value ?? p.value * 0.5,
    p99: p99Points[idx]?.value ?? p.value * 1.3,
  }));

  const errorChartData = (metrics?.errorRate || []).map((p) => ({
    timestamp: p.timestamp,
    errorRate: p.value,
  }));

  const requestChartData = (metrics?.requestRate || []).map((p) => ({
    timestamp: p.timestamp,
    requests: p.value,
  }));

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Top Navigation */}
      <div className="flex items-center justify-between pb-1 border-b border-border">
        <Link
          to="/services"
          className="inline-flex items-center gap-1.5 text-xs text-txt-muted hover:text-txt-primary font-mono transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Services / {service.name}</span>
        </Link>

        <a
          href={`http://localhost:3000/explore?orgId=1&left=%5B%22now-1h%22,%22now%22,%22Prometheus%22,%7B%22expr%22:%22rate(http_server_request_duration_seconds_count%7Bservice_name%3D%5C%22${service.name}%5C%22%7D%5B5m%5D)%22%7D%5D`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm bg-surface hover:bg-surface-raised text-xs font-mono text-txt-secondary hover:text-txt-primary border border-border transition-colors"
        >
          <span>Grafana Drilldown</span>
          <ExternalLink className="w-3 h-3 text-txt-muted" />
        </a>
      </div>

      {/* Service Header Info Box */}
      <div className="rounded-sm border border-border bg-surface p-3.5 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-sm bg-surface-raised border border-border flex items-center justify-center text-accent">
              <Server className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-txt-primary">{service.name}</h2>
                <StatusBadge status={service.health?.status || 'unknown'} size="sm" />
                <span className="text-[11px] px-1.5 py-0.2 rounded-sm bg-surface-raised border border-border text-txt-muted font-mono">
                  {service.environment}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono tabular-nums">
            <div>
              <span className="text-[10px] uppercase text-txt-muted block">Active Incidents</span>
              <span
                className={`text-xs font-bold ${
                  (service.health?.activeIncidentCount ?? 0) > 0 ? 'text-[#f85149]' : 'text-[#3fb950]'
                }`}
              >
                {service.health?.activeIncidentCount ?? 0}
              </span>
            </div>
          </div>
        </div>

        {service.description && (
          <p className="text-xs text-txt-secondary leading-relaxed font-sans">{service.description}</p>
        )}

        {service.tags && service.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1 border-t border-border-subtle">
            {service.tags.map((t, idx) => (
              <span
                key={idx}
                className="text-[10px] px-1.5 py-0.2 rounded-sm bg-surface-raised text-txt-muted font-mono border border-border-subtle"
              >
                #{t}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-border gap-2 text-xs font-mono">
        <button
          onClick={() => setActiveTab('metrics')}
          className={`px-3 py-1.5 transition-colors border-b-2 cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'metrics'
              ? 'border-accent text-txt-primary font-medium bg-surface'
              : 'border-transparent text-txt-muted hover:text-txt-primary'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Telemetry Charts</span>
        </button>

        <button
          onClick={() => setActiveTab('traces')}
          className={`px-3 py-1.5 transition-colors border-b-2 cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'traces'
              ? 'border-accent text-txt-primary font-medium bg-surface'
              : 'border-transparent text-txt-muted hover:text-txt-primary'
          }`}
        >
          <Search className="w-3.5 h-3.5" />
          <span>Distributed Traces</span>
        </button>

        <button
          onClick={() => setActiveTab('rules')}
          className={`px-3 py-1.5 transition-colors border-b-2 cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'rules'
              ? 'border-accent text-txt-primary font-medium bg-surface'
              : 'border-transparent text-txt-muted hover:text-txt-primary'
          }`}
        >
          <BellRing className="w-3.5 h-3.5" />
          <span>Alert Rules & SLOs</span>
        </button>

        <button
          onClick={() => setActiveTab('deployments')}
          className={`px-3 py-1.5 transition-colors border-b-2 cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'deployments'
              ? 'border-accent text-txt-primary font-medium bg-surface'
              : 'border-transparent text-txt-muted hover:text-txt-primary'
          }`}
        >
          <GitCommit className="w-3.5 h-3.5" />
          <span>Deployments</span>
        </button>
      </div>

      {/* ── Tab Content: Metrics ────────────────────────────────────────────── */}
      {activeTab === 'metrics' && (
        <div className="space-y-3">
          {isMetricsLoading && <LoadingSkeleton rows={2} height="h-44" />}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <TimeSeriesChart
              title="Latency Percentiles (p50, p95, p99)"
              data={latencyChartData}
              unit="ms"
              height={200}
              series={[
                { key: 'p99', name: 'p99 Latency', color: '#f85149' },
                { key: 'p95', name: 'p95 Latency', color: '#d29922' },
                { key: 'p50', name: 'p50 Latency', color: '#3fb950' },
              ]}
            />

            <TimeSeriesChart
              title="HTTP 5xx Error Rate"
              data={errorChartData}
              unit="%"
              height={200}
              series={[{ key: 'errorRate', name: '5xx Rate', color: '#f85149' }]}
            />
          </div>

          <TimeSeriesChart
            title="Request Throughput"
            data={requestChartData}
            unit=" req/s"
            height={180}
            series={[{ key: 'requests', name: 'Req/s', color: '#2f81f7' }]}
          />
        </div>
      )}

      {/* ── Tab Content: Traces ─────────────────────────────────────────────── */}
      {activeTab === 'traces' && (
        <div>
          {isTracesLoading ? (
            <LoadingSkeleton rows={3} height="h-9" />
          ) : !tracesData || tracesData.data.length === 0 ? (
            <EmptyState
              title="No traces ingested"
              description="No distributed traces recorded for this service in the active time window."
            />
          ) : (
            <DataTable>
              <TableHead>
                <tr>
                  <TableHeaderCell className="w-20">Status</TableHeaderCell>
                  <TableHeaderCell className="w-40">Trace ID</TableHeaderCell>
                  <TableHeaderCell>Root Operation</TableHeaderCell>
                  <TableHeaderCell align="right" className="w-28">Spans</TableHeaderCell>
                  <TableHeaderCell align="right" className="w-28">Duration</TableHeaderCell>
                  <TableHeaderCell align="right" className="w-24">Action</TableHeaderCell>
                </tr>
              </TableHead>
              <TableBody>
                {tracesData.data.map((trace) => (
                  <TableRow key={trace.traceId}>
                    <TableCell>
                      <span className={`font-mono text-[10px] uppercase px-1.5 py-0.2 rounded-sm border ${
                        trace.hasErrors
                          ? 'bg-[#f85149]/10 text-[#f85149] border-[#f85149]/30'
                          : 'bg-[#3fb950]/10 text-[#3fb950] border-[#3fb950]/30'
                      }`}>
                        {trace.hasErrors ? 'Error' : 'OK'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <MonoId id={trace.traceId} truncateLength={14} />
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs text-txt-primary">
                        {trace.rootSpan.operationName}
                      </span>
                    </TableCell>
                    <TableCell align="right">
                      <span className="font-mono text-xs text-txt-secondary tabular-nums">
                        {trace.spans.length}
                      </span>
                    </TableCell>
                    <TableCell align="right">
                      <span className="font-mono text-xs text-txt-primary tabular-nums">
                        {trace.totalDuration.toFixed(1)}ms
                      </span>
                    </TableCell>
                    <TableCell align="right">
                      <Link
                        to={`/explorer?traceId=${trace.traceId}`}
                        className="px-2 py-0.5 text-[11px] font-mono rounded-sm bg-surface-raised hover:bg-surface-active text-txt-primary border border-border hover:border-accent transition-colors inline-flex items-center gap-1"
                      >
                        <span>Waterfall</span>
                        <ArrowRight className="w-2.5 h-2.5 text-txt-muted" />
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </DataTable>
          )}
        </div>
      )}

      {/* ── Tab Content: Rules ──────────────────────────────────────────────── */}
      {activeTab === 'rules' && (
        <div>
          {isRulesLoading ? (
            <LoadingSkeleton rows={3} height="h-9" />
          ) : !rulesData || rulesData.data.length === 0 ? (
            <EmptyState
              title="No rules configured"
              description="No alert rules or SLO monitors defined specifically for this service."
            />
          ) : (
            <DataTable>
              <TableHead>
                <tr>
                  <TableHeaderCell className="w-20">Severity</TableHeaderCell>
                  <TableHeaderCell>Rule Name</TableHeaderCell>
                  <TableHeaderCell>Expression</TableHeaderCell>
                  <TableHeaderCell className="w-24">Window</TableHeaderCell>
                  <TableHeaderCell align="right" className="w-24">State</TableHeaderCell>
                </tr>
              </TableHead>
              <TableBody>
                {rulesData.data.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell>
                      <SeverityBadge severity={rule.severity} size="sm" />
                    </TableCell>
                    <TableCell>
                      <span className="font-medium text-xs text-txt-primary">
                        {rule.name}
                      </span>
                    </TableCell>
                    <TableCell>
                      <code className="font-mono text-[11px] text-accent bg-surface-raised px-1.5 py-0.5 rounded-sm border border-border-subtle">
                        {rule.metric} {rule.operator.replace(/_/g, ' ')} {rule.threshold}
                      </code>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs text-txt-muted tabular-nums">
                        {rule.windowMinutes}m
                      </span>
                    </TableCell>
                    <TableCell align="right">
                      <span className={`font-mono text-[10px] uppercase px-1.5 py-0.5 rounded-sm border ${
                        rule.enabled
                          ? 'bg-[#3fb950]/10 text-[#3fb950] border-[#3fb950]/30'
                          : 'bg-surface-raised text-txt-muted border-border'
                      }`}>
                        {rule.enabled ? 'Active' : 'Disabled'}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </DataTable>
          )}
        </div>
      )}

      {/* ── Tab Content: Deployments ────────────────────────────────────────── */}
      {activeTab === 'deployments' && (
        <div>
          {isDeploymentsLoading ? (
            <LoadingSkeleton rows={3} height="h-9" />
          ) : !deploymentsData || deploymentsData.data.length === 0 ? (
            <EmptyState
              title="No deployments recorded"
              description="No deployment release events have been registered for this service."
            />
          ) : (
            <DataTable>
              <TableHead>
                <tr>
                  <TableHeaderCell className="w-28">Version</TableHeaderCell>
                  <TableHeaderCell className="w-32">Commit</TableHeaderCell>
                  <TableHeaderCell>Release Notes</TableHeaderCell>
                  <TableHeaderCell className="w-32">Author</TableHeaderCell>
                  <TableHeaderCell align="right" className="w-36">Deployed At</TableHeaderCell>
                </tr>
              </TableHead>
              <TableBody>
                {deploymentsData.data.map((dep) => (
                  <TableRow key={dep.id}>
                    <TableCell>
                      <span className="font-mono text-xs font-semibold text-txt-primary">
                        {dep.version}
                      </span>
                    </TableCell>
                    <TableCell>
                      {dep.commitSha ? <MonoId id={dep.commitSha} truncateLength={8} /> : '—'}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-txt-secondary line-clamp-1 font-sans">
                        {dep.releaseNotes || 'Standard production build'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-[11px] text-txt-muted">
                        {dep.deployedBy || 'ci/cd'}
                      </span>
                    </TableCell>
                    <TableCell align="right">
                      <span className="font-mono text-[11px] text-txt-muted tabular-nums">
                        {new Date(dep.deployedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </DataTable>
          )}
        </div>
      )}
    </div>
  );
};
