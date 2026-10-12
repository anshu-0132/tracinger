import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { MonoId } from '../components/MonoId';
import { LoadingSkeleton, ErrorBanner, EmptyState } from '../components/FeedbackStates';
import type { SpanInfo } from '@tracelens/shared';
import {
  Search,
  FileText,
  Layers,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

export const ExplorerPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTraceId = searchParams.get('traceId') || '';
  const initialService = searchParams.get('service') || '';

  const [activeTab, setActiveTab] = useState<'traces' | 'logs'>(
    initialTraceId ? 'traces' : 'traces'
  );

  // Logs filters & expanded states
  const [serviceFilter, setServiceFilter] = useState(initialService);
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [logTraceId, setLogTraceId] = useState('');
  const [expandedLogIndices, setExpandedLogIndices] = useState<Record<number, boolean>>({});

  // Trace lookup
  const [traceIdInput, setTraceIdInput] = useState(initialTraceId || '4bf92f3577b34da6a3ce929d0e0e4736');
  const [selectedSpan, setSelectedSpan] = useState<SpanInfo | null>(null);

  const { data: servicesData } = useQuery({
    queryKey: ['services'],
    queryFn: () => api.getServices(),
  });

  // Query logs
  const {
    data: logsData,
    isLoading: isLogsLoading,
    error: logsError,
    refetch: refetchLogs,
  } = useQuery({
    queryKey: ['logs', serviceFilter, levelFilter, searchQuery, logTraceId],
    queryFn: () =>
      api.getLogs({
        service: serviceFilter || undefined,
        level: levelFilter === 'all' ? undefined : (levelFilter as any),
        search: searchQuery || undefined,
        traceId: logTraceId || undefined,
        limit: 100,
      }),
    enabled: activeTab === 'logs',
  });

  // Query trace
  const {
    data: traceData,
    isLoading: isTraceLoading,
    error: traceError,
    refetch: refetchTrace,
  } = useQuery({
    queryKey: ['trace', traceIdInput],
    queryFn: () => (traceIdInput ? api.getTrace(traceIdInput) : Promise.reject('No trace ID')),
    enabled: activeTab === 'traces' && !!traceIdInput,
    retry: false,
  });

  const logs = logsData?.data || [];
  const services = servicesData?.data || [];

  const handleTraceLookup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!traceIdInput.trim()) return;
    setSearchParams({ traceId: traceIdInput.trim() });
    refetchTrace();
  };

  const handleInspectTraceFromLog = (tid: string) => {
    setTraceIdInput(tid);
    setActiveTab('traces');
    setSearchParams({ traceId: tid });
  };

  const toggleLogExpand = (idx: number) => {
    setExpandedLogIndices((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  // Helper to determine depth for waterfall indentation
  const getSpanDepth = (span: SpanInfo, spans: SpanInfo[]): number => {
    if (!span.parentSpanId) return 0;
    const parent = spans.find((s) => s.spanId === span.parentSpanId);
    if (!parent) return 1;
    return 1 + getSpanDepth(parent, spans);
  };

  return (
    <div className="space-y-3 max-w-7xl mx-auto">
      {/* ── Toolbar & Tabs ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pb-1 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-semibold text-txt-primary">
            Telemetry Explorer
          </span>
          <span className="text-[11px] font-mono text-txt-muted">
            Distributed trace waterfall & structured logs
          </span>
        </div>

        <div className="flex items-center gap-1 bg-surface border border-border rounded-sm p-0.5 text-xs font-mono">
          <button
            onClick={() => setActiveTab('traces')}
            className={`px-2.5 py-1 rounded-sm transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'traces'
                ? 'bg-surface-raised text-txt-primary font-medium'
                : 'text-txt-muted hover:text-txt-primary'
            }`}
          >
            <Layers className="w-3 h-3" />
            <span>Trace Waterfall</span>
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-2.5 py-1 rounded-sm transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'logs'
                ? 'bg-surface-raised text-txt-primary font-medium'
                : 'text-txt-muted hover:text-txt-primary'
            }`}
          >
            <FileText className="w-3 h-3" />
            <span>Log Stream</span>
          </button>
        </div>
      </div>

      {/* ── Trace Waterfall Explorer ────────────────────────────────────────── */}
      {activeTab === 'traces' && (
        <div className="space-y-3">
          {/* Trace Search Input Bar */}
          <form onSubmit={handleTraceLookup} className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-txt-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                placeholder="OpenTelemetry Trace ID (32 hex characters)..."
                value={traceIdInput}
                onChange={(e) => setTraceIdInput(e.target.value)}
                className="w-full rounded-sm bg-surface border border-border pl-8 pr-2.5 py-1 text-xs text-txt-primary font-mono placeholder-txt-muted focus:outline-none focus:border-accent"
              />
            </div>
            <button
              type="submit"
              disabled={isTraceLoading}
              className="px-3 py-1 rounded-sm bg-accent hover:bg-accent/90 text-xs font-mono font-medium text-white transition-colors cursor-pointer"
            >
              Inspect Trace
            </button>
          </form>

          {isTraceLoading && <LoadingSkeleton rows={5} height="h-10" />}

          {traceError && (
            <ErrorBanner
              title="Trace lookup error"
              message="No spans located for this trace ID in the storage backend. Run a Replay scenario or check Tempo connectivity."
            />
          )}

          {traceData && (
            <div className="space-y-3">
              {/* Trace Summary Strip */}
              <div className="rounded-sm border border-border bg-surface p-3 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
                <div className="flex items-center gap-2.5">
                  <span className="font-semibold text-txt-primary">
                    {traceData.rootSpan.operationName}
                  </span>
                  <span className="text-[11px] px-1.5 py-0.2 rounded-sm bg-surface-raised border border-border-subtle text-txt-secondary">
                    {traceData.rootSpan.serviceName}
                  </span>
                  <span className={`text-[10px] uppercase px-1.5 py-0.2 rounded-sm border ${
                    traceData.hasErrors
                      ? 'bg-[#f85149]/10 text-[#f85149] border-[#f85149]/30'
                      : 'bg-[#3fb950]/10 text-[#3fb950] border-[#3fb950]/30'
                  }`}>
                    {traceData.hasErrors ? 'Span Error' : 'OK'}
                  </span>
                </div>

                <div className="flex items-center gap-4 text-[11px] text-txt-muted tabular-nums">
                  <span>Duration: <strong className="text-txt-primary font-medium">{traceData.totalDuration.toFixed(1)}ms</strong></span>
                  <span>Spans: <strong className="text-txt-primary font-medium">{traceData.spans.length}</strong></span>
                  <span>Services: <strong className="text-txt-primary font-medium">{traceData.services.length}</strong></span>
                </div>
              </div>

              {/* Waterfall Hierarchy Table */}
              <div className="rounded-sm border border-border bg-surface overflow-hidden">
                <div className="p-2 border-b border-border bg-surface-raised flex items-center justify-between text-[11px] font-mono text-txt-secondary uppercase tracking-wider">
                  <span>Span Operation / Hierarchy</span>
                  <span>Relative Duration Bar</span>
                </div>

                <div className="divide-y divide-border-subtle">
                  {traceData.spans.map((span) => {
                    const depth = getSpanDepth(span, traceData.spans);
                    const widthPct = Math.max(
                      (span.duration / Math.max(traceData.totalDuration, 1)) * 100,
                      2
                    );
                    const isError = span.status === 'error';
                    const isSelected = selectedSpan?.spanId === span.spanId;

                    return (
                      <div
                        key={span.spanId}
                        onClick={() => setSelectedSpan(span)}
                        className={`p-2 flex items-center gap-3 text-xs font-mono transition-colors cursor-pointer select-none ${
                          isSelected ? 'bg-accent-subtle' : 'hover:bg-surface-raised/60'
                        }`}
                      >
                        {/* Indented Operation Label */}
                        <div
                          className="w-72 shrink-0 truncate flex items-center gap-1.5"
                          style={{ paddingLeft: `${depth * 14}px` }}
                        >
                          {depth > 0 && (
                            <span className="text-txt-muted">└</span>
                          )}
                          <span className={`truncate font-medium ${isError ? 'text-[#f85149]' : 'text-txt-primary'}`}>
                            {span.operationName}
                          </span>
                          <span className="text-[10px] text-txt-muted shrink-0">
                            ({span.serviceName})
                          </span>
                        </div>

                        {/* Relative Waterfall Duration Bar */}
                        <div className="flex-1 flex items-center gap-2">
                          <div className="flex-1 h-3.5 bg-surface-raised rounded-sm overflow-hidden relative">
                            <div
                              style={{ width: `${widthPct}%` }}
                              className={`h-full rounded-sm transition-all flex items-center px-1 text-[9px] font-mono font-bold text-white ${
                                isError ? 'bg-[#f85149]' : 'bg-accent'
                              }`}
                            >
                              {widthPct > 12 && `${span.duration.toFixed(0)}ms`}
                            </div>
                          </div>
                          <span className="w-16 text-right font-mono text-[11px] text-txt-secondary tabular-nums shrink-0">
                            {span.duration.toFixed(1)}ms
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Span Attributes Inspector */}
              {selectedSpan && (
                <div className="rounded-sm border border-border bg-surface p-3 space-y-2 text-xs font-mono">
                  <div className="flex items-center justify-between pb-1 border-b border-border-subtle">
                    <span className="font-semibold text-txt-primary">
                      Span Details: {selectedSpan.operationName}
                    </span>
                    <button
                      onClick={() => setSelectedSpan(null)}
                      className="text-txt-muted hover:text-txt-primary cursor-pointer"
                    >
                      Close [x]
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-txt-secondary pb-1">
                    <div>Span ID: <MonoId id={selectedSpan.spanId} truncateLength={10} /></div>
                    <div>Service: <strong className="text-txt-primary font-normal">{selectedSpan.serviceName}</strong></div>
                    <div>Duration: <strong className="text-txt-primary font-normal">{selectedSpan.duration.toFixed(1)}ms</strong></div>
                    <div>Status: <strong className={selectedSpan.status === 'error' ? 'text-[#f85149]' : 'text-[#3fb950]'}>{selectedSpan.status}</strong></div>
                  </div>
                  <pre className="text-[11px] text-txt-secondary bg-surface-raised p-2 rounded-sm border border-border-subtle overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-48">
                    {JSON.stringify(selectedSpan.attributes, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Structured Logs Explorer ────────────────────────────────────────── */}
      {activeTab === 'logs' && (
        <div className="space-y-3">
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-2 p-2 rounded-sm bg-surface border border-border text-xs">
            <select
              aria-label="Filter logs by service"
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
              className="rounded-sm bg-surface-raised border border-border px-2 py-1 text-xs text-txt-primary focus:outline-none focus:border-accent font-mono"
            >
              <option value="">All Services</option>
              {services.map((s) => (
                <option key={s.id} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter logs by level"
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              className="rounded-sm bg-surface-raised border border-border px-2 py-1 text-xs text-txt-primary focus:outline-none focus:border-accent font-mono"
            >
              <option value="all">All Levels</option>
              <option value="info">INFO</option>
              <option value="warn">WARN</option>
              <option value="error">ERROR</option>
              <option value="debug">DEBUG</option>
            </select>

            <div className="relative flex-1 min-w-[160px]">
              <Search className="w-3 h-3 text-txt-muted absolute left-2 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search log messages (regex / substring)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-sm bg-surface-raised border border-border pl-7 pr-2 py-1 text-xs text-txt-primary placeholder-txt-muted focus:outline-none focus:border-accent font-sans"
              />
            </div>

            <input
              type="text"
              placeholder="Filter by Trace ID..."
              value={logTraceId}
              onChange={(e) => setLogTraceId(e.target.value)}
              className="rounded-sm bg-surface-raised border border-border px-2 py-1 text-xs text-txt-primary font-mono placeholder-txt-muted focus:outline-none focus:border-accent w-40"
            />
          </div>

          {isLogsLoading && <LoadingSkeleton rows={6} height="h-8" />}

          {logsError && (
            <ErrorBanner
              title="Log query error"
              message={logsError instanceof Error ? logsError.message : 'Failed to query Loki log storage'}
              onRetry={() => refetchLogs()}
            />
          )}

          {!isLogsLoading && !logsError && logs.length === 0 && (
            <EmptyState
              title="0 log records found"
              description="No logs matching active filter criteria. Check Loki log ingestion."
              icon={<FileText className="w-4 h-4" />}
            />
          )}

          {/* Monospace Log Results with Expandable JSON rows */}
          {logs.length > 0 && (
            <div className="rounded-sm border border-border bg-surface overflow-hidden font-mono text-xs">
              <div className="divide-y divide-border-subtle">
                {logs.map((log, idx) => {
                  const isError = log.level === 'error' || log.level === 'fatal';
                  const isWarn = log.level === 'warn';
                  const isExpanded = !!expandedLogIndices[idx];

                  const levelColor = isError
                    ? 'text-[#f85149]'
                    : isWarn
                    ? 'text-[#d29922]'
                    : 'text-[#2f81f7]';

                  return (
                    <div key={idx} className="hover:bg-surface-raised/40 transition-colors">
                      {/* Summary line */}
                      <div
                        onClick={() => toggleLogExpand(idx)}
                        className="p-2 flex items-start gap-2.5 cursor-pointer select-none"
                      >
                        <button
                          type="button"
                          className="text-txt-muted p-0.5 mt-0.5 hover:text-txt-primary"
                          aria-label={isExpanded ? 'Collapse log row' : 'Expand log row'}
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-3 h-3" />
                          ) : (
                            <ChevronRight className="w-3 h-3" />
                          )}
                        </button>

                        <span className="text-txt-muted text-[11px] shrink-0 tabular-nums">
                          {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>

                        <span className={`text-[10px] font-bold uppercase shrink-0 w-12 ${levelColor}`}>
                          {log.level}
                        </span>

                        {log.service && (
                          <span className="text-txt-secondary text-[11px] shrink-0">
                            [{log.service}]
                          </span>
                        )}

                        <span className="flex-1 text-txt-primary font-sans text-xs truncate">
                          {log.message}
                        </span>

                        {log.traceId && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleInspectTraceFromLog(log.traceId!);
                            }}
                            className="text-[10px] font-mono text-accent hover:underline shrink-0"
                            title="Inspect trace waterfall"
                          >
                            trace:{log.traceId.slice(0, 8)}…
                          </button>
                        )}
                      </div>

                      {/* Expandable JSON Row */}
                      {isExpanded && (
                        <div className="px-8 pb-3 pt-1 border-t border-border-subtle/50 bg-surface-raised/60">
                          <span className="text-[10px] font-mono uppercase text-txt-muted block mb-1">
                            Structured Log Payload:
                          </span>
                          <pre className="text-[11px] font-mono text-txt-secondary bg-surface p-2 rounded-sm border border-border-subtle overflow-x-auto whitespace-pre-wrap leading-relaxed">
                            {JSON.stringify(log, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
