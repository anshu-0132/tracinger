import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { SeverityBadge } from '../components/SeverityBadge';
import { EvidenceCard } from '../components/EvidenceCard';
import { TimeSeriesChart } from '../components/TimeSeriesChart';
import { MonoId } from '../components/MonoId';
import { LoadingSkeleton, ErrorBanner } from '../components/FeedbackStates';
import type { RootCauseCandidate } from '@tracinger/shared';
import {
  ArrowLeft,
  Activity,
  GitCommit,
  Check,
  Send,
  ExternalLink,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';

export const IncidentInvestigationPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [newNote, setNewNote] = useState('');
  const queryClient = useQueryClient();

  const {
    data: incident,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['incident', id],
    queryFn: () => (id ? api.getIncident(id) : Promise.reject('No ID')),
    enabled: !!id,
    refetchInterval: 10000,
  });

  const serviceId = incident?.serviceId || incident?.service?.name || 'svc-order';

  const { data: metrics } = useQuery({
    queryKey: ['serviceMetrics', serviceId],
    queryFn: () => api.getServiceMetrics(serviceId),
    enabled: !!incident,
  });

  const updateStatusMutation = useMutation({
    mutationFn: (status: 'ACKNOWLEDGED' | 'RESOLVED') =>
      id ? api.updateIncidentStatus(id, { status }) : Promise.reject('No ID'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incident', id] });
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
    },
  });

  const analyzeMutation = useMutation({
    mutationFn: () => (id ? api.analyzeIncident(id) : Promise.reject('No ID')),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incident', id] });
    },
  });

  const addNoteMutation = useMutation({
    mutationFn: (noteText: string) =>
      id ? api.addIncidentNote(id, { note: noteText, createdBy: 'investigator' }) : Promise.reject('No ID'),
    onSuccess: () => {
      setNewNote('');
      queryClient.invalidateQueries({ queryKey: ['incident', id] });
    },
  });

  if (isLoading) {
    return <LoadingSkeleton rows={6} height="h-24" />;
  }

  if (error || !incident) {
    return (
      <ErrorBanner
        title="Incident not found"
        message={error instanceof Error ? error.message : 'Unable to load incident details'}
        onRetry={() => refetch()}
      />
    );
  }

  const candidates: RootCauseCandidate[] = (incident.evidenceJson as any) || [];
  const isOpen = incident.status === 'OPEN';
  const isResolved = incident.status === 'RESOLVED';

  const calculateDuration = () => {
    const start = new Date(incident.startedAt).getTime();
    if (incident.resolvedAt) {
      const end = new Date(incident.resolvedAt).getTime();
      const mins = Math.max(1, Math.floor((end - start) / 60000));
      if (mins < 60) return `${mins}m`;
      const hours = Math.floor(mins / 60);
      return `${hours}h ${mins % 60}m`;
    }
    return 'active';
  };

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    addNoteMutation.mutate(newNote.trim());
  };

  const getStatusPill = (status: string) => {
    const configs: Record<string, string> = {
      OPEN: 'bg-[#f85149]/10 text-[#f85149] border-[#f85149]/30',
      ACKNOWLEDGED: 'bg-[#d29922]/10 text-[#d29922] border-[#d29922]/30',
      RESOLVED: 'bg-[#3fb950]/10 text-[#3fb950] border-[#3fb950]/30',
    };
    const style = configs[status] || 'bg-surface-raised text-txt-secondary border-border';
    return (
      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-sm border font-mono text-[10px] uppercase tracking-wider ${style}`}>
        {status}
      </span>
    );
  };

  // Format telemetry metrics for TimeSeriesChart
  const chartData = (metrics?.errorRate || []).map((pt, i) => ({
    timestamp: pt.timestamp,
    errorRate: pt.value,
    p95Latency: metrics?.p95Latency?.[i]?.value || 0,
  }));

  const deploymentMarker = incident.correlatedDeployment
    ? [
        {
          x: incident.correlatedDeployment.deployedAt,
          label: `deploy: ${incident.correlatedDeployment.version}`,
          color: 'var(--status-unhealthy-text, #f85149)',
        },
      ]
    : [];

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Top Breadcrumb & Quick Navigation */}
      <div className="flex items-center justify-between pb-1 border-b border-border">
        <div className="flex items-center gap-2 text-xs">
          <Link
            to="/incidents"
            className="text-txt-muted hover:text-txt-primary flex items-center gap-1 transition-colors font-mono"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Incidents</span>
          </Link>
          <span className="text-txt-muted">/</span>
          <span className="font-mono text-txt-secondary font-medium">
            {incident.id}
          </span>
        </div>

        {/* State Machine Action Controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => analyzeMutation.mutate()}
            disabled={analyzeMutation.isPending}
            className="px-2.5 py-1 text-xs font-mono rounded-sm bg-surface hover:bg-surface-raised text-accent border border-border hover:border-accent transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Re-run deterministic root-cause analysis"
          >
            <RefreshCw className={`w-3 h-3 ${analyzeMutation.isPending ? 'animate-spin' : ''}`} />
            <span>{analyzeMutation.isPending ? 'Analyzing…' : 'Re-run RCA'}</span>
          </button>

          {isOpen && (
            <button
              onClick={() => updateStatusMutation.mutate('ACKNOWLEDGED')}
              disabled={updateStatusMutation.isPending}
              className="px-2.5 py-1 text-xs font-mono rounded-sm bg-surface hover:bg-surface-raised text-[#d29922] border border-[#d29922]/35 transition-colors cursor-pointer"
            >
              Acknowledge
            </button>
          )}

          {!isResolved && (
            <button
              onClick={() => updateStatusMutation.mutate('RESOLVED')}
              disabled={updateStatusMutation.isPending}
              className="px-2.5 py-1 text-xs font-mono rounded-sm bg-surface hover:bg-surface-raised text-[#3fb950] border border-[#3fb950]/35 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Check className="w-3 h-3" />
              <span>Resolve</span>
            </button>
          )}
        </div>
      </div>

      {/* Correlated Metric Chart with Deployment Marker */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-txt-secondary">
              Correlated Telemetry Window
            </span>
            {incident.correlatedDeployment && (
              <span className="inline-flex items-center gap-1 font-mono text-[10px] text-accent px-1.5 py-0.2 rounded-sm bg-accent-subtle border border-accent-border">
                <GitCommit className="w-2.5 h-2.5" />
                <span>Marker: {incident.correlatedDeployment.version}</span>
              </span>
            )}
          </div>
          <span className="font-mono text-[10px] text-txt-muted tabular-nums">
            window: started {new Date(incident.startedAt).toLocaleTimeString()}
          </span>
        </div>
        <TimeSeriesChart
          data={chartData}
          series={[
            { key: 'errorRate', name: 'Error Rate', color: '#f85149' },
            { key: 'p95Latency', name: 'P95 Latency (ms)', color: '#d29922', strokeDasharray: '4 4' },
          ]}
          height={180}
          referenceLines={deploymentMarker}
        />
      </div>

      {/* ── Two-Column Incident Investigation Layout ──────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column (Span 7): Incident Meta & Ranked Candidates */}
        <div className="lg:col-span-7 space-y-3">
          {/* Header & Status Card */}
          <div className="rounded-sm border border-border bg-surface p-3.5 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <SeverityBadge severity={incident.severity} size="sm" />
                {getStatusPill(incident.status)}
                <span className="font-mono text-xs text-txt-secondary px-1.5 py-0.5 rounded-sm bg-surface-raised border border-border-subtle">
                  {incident.service?.name || incident.serviceName || 'order-service'}
                </span>
              </div>
              <MonoId id={incident.fingerprint} truncateLength={16} prefix="fp:" />
            </div>

            <div>
              <h2 className="text-sm font-semibold text-txt-primary">
                {incident.title}
              </h2>
              {incident.description && (
                <p className="text-xs text-txt-secondary mt-1 leading-relaxed">
                  {incident.description}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-4 text-[11px] font-mono text-txt-muted pt-1 border-t border-border-subtle tabular-nums">
              <span>
                Started: <strong className="text-txt-primary font-normal">{new Date(incident.startedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</strong>
              </span>
              <span>
                Duration: <strong className="text-txt-primary font-normal">{calculateDuration()}</strong>
              </span>
              {incident.currentValue !== undefined && incident.threshold !== undefined && (
                <span>
                  Metric: <strong className="text-[#d29922] font-normal">{incident.currentValue}</strong> &gt; {incident.threshold}
                </span>
              )}
            </div>
          </div>

          {/* Correlated Deployment Summary Banner */}
          {incident.correlatedDeployment && (
            <div className="rounded-sm border border-border bg-surface p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GitCommit className="w-3.5 h-3.5 text-accent" />
                  <span className="font-mono text-xs font-semibold text-txt-primary">
                    Correlated Deployment Event
                  </span>
                  <span className="font-mono text-[11px] text-accent px-1.5 py-0.2 rounded-sm bg-accent-subtle border border-accent-border">
                    {incident.correlatedDeployment.version}
                  </span>
                </div>
                {incident.correlatedDeployment.commitSha && (
                  <MonoId id={incident.correlatedDeployment.commitSha} truncateLength={8} />
                )}
              </div>
              {incident.correlatedDeployment.releaseNotes && (
                <p className="text-[11px] text-txt-secondary leading-normal">
                  {incident.correlatedDeployment.releaseNotes}
                </p>
              )}
              <div className="text-[10px] font-mono text-txt-muted flex items-center gap-3 tabular-nums">
                <span>Deployed: {new Date(incident.correlatedDeployment.deployedAt).toLocaleTimeString()}</span>
                <span>By: {incident.correlatedDeployment.deployedBy || 'ci/cd'}</span>
              </div>
            </div>
          )}

          {/* Ranked Root Cause Candidate Leads */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-accent" />
                <h3 className="text-xs font-semibold text-txt-primary uppercase tracking-wider font-mono">
                  Ranked Root-Cause Leads ({candidates.length})
                </h3>
              </div>
              <span className="text-[10px] font-mono text-txt-muted">
                Signal correlation ranking
              </span>
            </div>

            {candidates.length === 0 ? (
              <div className="rounded-sm border border-border bg-surface p-4 text-center text-xs text-txt-muted">
                No telemetry leads identified. Click "Re-run RCA" to evaluate live traces.
              </div>
            ) : (
              <div className="space-y-2">
                {candidates.map((candidate) => (
                  <EvidenceCard key={candidate.rank} candidate={candidate} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (Span 5): Audit Timeline, Notes, Deep Links */}
        <div className="lg:col-span-5 space-y-3">
          {/* Vertical Audit Timeline */}
          <div className="rounded-sm border border-border bg-surface p-3.5 space-y-3">
            <div className="flex items-center justify-between pb-1.5 border-b border-border-subtle">
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-txt-secondary font-mono">
                Audit Timeline
              </h4>
              <span className="text-[10px] font-mono text-txt-muted tabular-nums">
                {incident.events?.length || 0} events
              </span>
            </div>

            <div className="relative pl-3 space-y-3 before:absolute before:left-1 before:top-1.5 before:bottom-1.5 before:w-px before:bg-border">
              {(!incident.events || incident.events.length === 0) ? (
                <p className="text-[11px] text-txt-muted">No timeline events recorded.</p>
              ) : (
                incident.events.map((ev) => (
                  <div key={ev.id} className="relative flex items-start gap-2.5 text-xs">
                    <span className="absolute -left-3 mt-1.5 w-1.5 h-1.5 rounded-full bg-accent ring-2 ring-surface shrink-0" />
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-xs text-txt-primary">
                          {ev.type.replace(/_/g, ' ')}
                        </span>
                        <span className="text-[10px] font-mono text-txt-muted tabular-nums">
                          {new Date(ev.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>
                      {ev.note && (
                        <p className="text-[11px] text-txt-secondary font-sans leading-normal">
                          {ev.note}
                        </p>
                      )}
                      <span className="text-[10px] font-mono text-txt-muted block">
                        actor: {ev.createdBy || 'system'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Investigation Notes Composer */}
          <div className="rounded-sm border border-border bg-surface p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-txt-secondary font-mono">
                Investigation Notes
              </h4>
              <span className="text-[10px] font-mono text-txt-muted">markdown</span>
            </div>

            <form onSubmit={handleAddNote} className="space-y-2">
              <textarea
                rows={3}
                placeholder="Log triage findings, hypotheses, mitigation steps..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                className="w-full rounded-sm bg-surface-raised border border-border p-2.5 text-xs text-txt-primary placeholder-txt-muted focus:outline-none focus:border-accent font-sans leading-relaxed"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={!newNote.trim() || addNoteMutation.isPending}
                  className="px-2.5 py-1 text-xs font-mono font-medium rounded-sm bg-surface-raised hover:bg-surface-active disabled:opacity-40 text-txt-primary border border-border hover:border-accent transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-3 h-3" />
                  <span>{addNoteMutation.isPending ? 'Saving…' : 'Add Note'}</span>
                </button>
              </div>
            </form>

            {incident.investigationNotes && (
              <div className="pt-2 border-t border-border-subtle">
                <span className="text-[10px] font-mono uppercase tracking-wider text-txt-muted block mb-1">
                  Log History
                </span>
                <pre className="text-[11px] font-mono text-txt-secondary bg-surface-raised p-2 rounded-sm border border-border-subtle whitespace-pre-wrap leading-relaxed max-h-36 overflow-y-auto">
                  {incident.investigationNotes}
                </pre>
              </div>
            )}
          </div>

          {/* Direct Observability Deep Links */}
          <div className="rounded-sm border border-border bg-surface p-3 space-y-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-txt-muted block">
              Observability Deep Links
            </span>
            <div className="flex flex-col gap-1">
              <a
                href={`http://localhost:3000/explore?orgId=1&left=%5B%22now-1h%22,%22now%22,%22Prometheus%22,%7B%22expr%22:%22rate(http_server_request_duration_seconds_count%7Bservice_name%3D%5C%22${incident.service?.name || 'order-service'}%5C%22%7D%5B5m%5D)%22%7D%5D`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between px-2.5 py-1.5 rounded-sm bg-surface-raised hover:bg-surface-active text-xs font-mono text-txt-secondary hover:text-txt-primary border border-border-subtle transition-colors"
              >
                <span>Grafana Metrics Panel</span>
                <ExternalLink className="w-3 h-3 text-txt-muted" />
              </a>
              <a
                href={`http://localhost:3000/explore?orgId=1&left=%5B%22now-1h%22,%22now%22,%22Loki%22,%7B%22expr%22:%22%7Bservice_name%3D%5C%22${incident.service?.name || 'order-service'}%5C%22%7D%22%7D%5D`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between px-2.5 py-1.5 rounded-sm bg-surface-raised hover:bg-surface-active text-xs font-mono text-txt-secondary hover:text-txt-primary border border-border-subtle transition-colors"
              >
                <span>Loki Error Logs</span>
                <ExternalLink className="w-3 h-3 text-txt-muted" />
              </a>
              <Link
                to={`/explorer?service=${incident.service?.name || 'order-service'}`}
                className="flex items-center justify-between px-2.5 py-1.5 rounded-sm bg-surface-raised hover:bg-surface-active text-xs font-mono text-txt-secondary hover:text-txt-primary border border-border-subtle transition-colors"
              >
                <span>Telemetry Explorer (Traces/Logs)</span>
                <ChevronRight className="w-3 h-3 text-txt-muted" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
