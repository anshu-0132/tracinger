import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
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
import { LoadingSkeleton, ErrorBanner, EmptyState } from '../components/FeedbackStates';
import { Filter, Check, ShieldAlert, ArrowRight } from 'lucide-react';

export const IncidentsPage: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['incidents', statusFilter, severityFilter, page],
    queryFn: () =>
      api.getIncidents({
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        severity: severityFilter === 'ALL' ? undefined : severityFilter,
        page,
        pageSize: 20,
        sortBy: 'startedAt',
        sortOrder: 'desc',
      }),
    refetchInterval: 15000,
  });

  const acknowledgeMutation = useMutation({
    mutationFn: (id: string) =>
      api.updateIncidentStatus(id, { status: 'ACKNOWLEDGED', assignee: 'on-call' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
    },
  });

  const resolveMutation = useMutation({
    mutationFn: (id: string) =>
      api.updateIncidentStatus(id, { status: 'RESOLVED', note: 'Resolved manually via console' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
    },
  });

  const incidents = data?.data || [];
  const total = data?.total || 0;
  const hasMore = data?.hasMore || false;

  const [referenceNow] = useState(() => Date.now());

  const getAge = (timestamp: string) => {
    const diffMs = referenceNow - new Date(timestamp).getTime();
    const diffSec = Math.max(0, Math.floor(diffMs / 1000));
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHrs = Math.floor(diffMin / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    return `${Math.floor(diffHrs / 24)}d ago`;
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

  const openCount = incidents.filter((i) => i.status === 'OPEN').length;

  return (
    <div className="space-y-3 max-w-7xl mx-auto">
      {/* Terse Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pb-1 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-semibold text-txt-primary">
            Incidents
          </span>
          <span className="text-[11px] font-mono text-txt-muted tabular-nums">
            {total} total · {openCount} open
          </span>
        </div>

        {/* Filter Toolbar Controls */}
        <div className="flex items-center gap-2">
          {/* Status Filter */}
          <div className="flex items-center gap-1.5 bg-surface border border-border rounded-sm px-2 py-1 text-xs">
            <Filter className="w-3 h-3 text-txt-muted" />
            <select
              aria-label="Filter incidents by status"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="bg-transparent border-none text-xs text-txt-primary focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-surface text-txt-primary">All statuses</option>
              <option value="OPEN" className="bg-surface text-txt-primary">Open</option>
              <option value="ACKNOWLEDGED" className="bg-surface text-txt-primary">Acknowledged</option>
              <option value="RESOLVED" className="bg-surface text-txt-primary">Resolved</option>
            </select>
          </div>

          {/* Severity Filter */}
          <div className="flex items-center gap-1.5 bg-surface border border-border rounded-sm px-2 py-1 text-xs">
            <span className="text-[10px] font-mono text-txt-muted uppercase">Sev:</span>
            <select
              aria-label="Filter incidents by severity"
              value={severityFilter}
              onChange={(e) => {
                setSeverityFilter(e.target.value);
                setPage(1);
              }}
              className="bg-transparent border-none text-xs text-txt-primary focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-surface text-txt-primary">All severities</option>
              <option value="CRITICAL" className="bg-surface text-txt-primary">Critical</option>
              <option value="HIGH" className="bg-surface text-txt-primary">High</option>
              <option value="MEDIUM" className="bg-surface text-txt-primary">Medium</option>
              <option value="LOW" className="bg-surface text-txt-primary">Low</option>
            </select>
          </div>
        </div>
      </div>

      {isLoading && <LoadingSkeleton rows={6} height="h-9" />}

      {error && (
        <ErrorBanner
          title="Incident fetch error"
          message={error instanceof Error ? error.message : 'Failed to retrieve active incident list'}
          onRetry={() => refetch()}
        />
      )}

      {!isLoading && !error && incidents.length === 0 && (
        <EmptyState
          title="0 incidents matching filters"
          description="No incidents match the active status or severity parameters."
          icon={<ShieldAlert className="w-4 h-4" />}
        />
      )}

      {/* Incidents Table */}
      {incidents.length > 0 && (
        <div className="space-y-2">
          <DataTable>
            <TableHead>
              <tr>
                <TableHeaderCell className="w-20">Severity</TableHeaderCell>
                <TableHeaderCell className="w-24">State</TableHeaderCell>
                <TableHeaderCell>Incident / Title</TableHeaderCell>
                <TableHeaderCell className="w-32">Service</TableHeaderCell>
                <TableHeaderCell className="w-24">Age</TableHeaderCell>
                <TableHeaderCell className="w-36">Fingerprint</TableHeaderCell>
                <TableHeaderCell align="right" className="w-40">Actions</TableHeaderCell>
              </tr>
            </TableHead>
            <TableBody>
              {incidents.map((inc) => {
                const isOpen = inc.status === 'OPEN';
                const isResolved = inc.status === 'RESOLVED';

                return (
                  <TableRow
                    key={inc.id}
                    onClick={() => navigate(`/incidents/${inc.id}`)}
                    className="cursor-pointer"
                  >
                    <TableCell>
                      <SeverityBadge severity={inc.severity} size="sm" />
                    </TableCell>
                    <TableCell>
                      {getStatusPill(inc.status)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <Link
                          to={`/incidents/${inc.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="font-medium text-xs text-txt-primary hover:text-accent truncate block"
                        >
                          {inc.title}
                        </Link>
                        {inc.currentValue !== undefined && inc.threshold !== undefined && (
                          <span className="font-mono text-[10px] text-txt-muted tabular-nums">
                            val: {inc.currentValue} / threshold: {inc.threshold}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-[11px] text-txt-secondary px-1.5 py-0.5 rounded-sm bg-surface-raised border border-border-subtle">
                        {inc.service.name}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-[11px] text-txt-muted tabular-nums">
                        {getAge(inc.startedAt)}
                      </span>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <MonoId id={inc.fingerprint} truncateLength={14} />
                    </TableCell>
                    <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        {isOpen && (
                          <button
                            onClick={() => acknowledgeMutation.mutate(inc.id)}
                            disabled={acknowledgeMutation.isPending}
                            className="px-2 py-0.5 text-[11px] font-mono rounded-sm bg-surface hover:bg-surface-raised text-[#d29922] border border-[#d29922]/30 transition-colors cursor-pointer"
                            title="Acknowledge incident"
                          >
                            Ack
                          </button>
                        )}
                        {!isResolved && (
                          <button
                            onClick={() => resolveMutation.mutate(inc.id)}
                            disabled={resolveMutation.isPending}
                            className="px-2 py-0.5 text-[11px] font-mono rounded-sm bg-surface hover:bg-surface-raised text-[#3fb950] border border-[#3fb950]/30 transition-colors inline-flex items-center gap-1 cursor-pointer"
                            title="Resolve incident"
                          >
                            <Check className="w-3 h-3" />
                            Resolve
                          </button>
                        )}
                        <Link
                          to={`/incidents/${inc.id}`}
                          className="px-2 py-0.5 text-[11px] font-mono rounded-sm bg-surface-raised hover:bg-surface-active text-txt-primary border border-border hover:border-accent transition-colors inline-flex items-center gap-1"
                        >
                          <span>Inspect</span>
                          <ArrowRight className="w-2.5 h-2.5 text-txt-muted" />
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </DataTable>

          {/* Pagination */}
          <div className="flex items-center justify-between text-[11px] font-mono text-txt-muted px-1 py-1">
            <span>
              Showing {incidents.length} of {total} records
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                disabled={page === 1}
                className="px-2 py-0.5 rounded-sm bg-surface disabled:opacity-40 disabled:cursor-not-allowed hover:bg-surface-raised text-txt-primary border border-border transition-colors cursor-pointer"
              >
                Prev
              </button>
              <span className="tabular-nums px-1.5 text-txt-secondary">p.{page}</span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={!hasMore}
                className="px-2 py-0.5 rounded-sm bg-surface disabled:opacity-40 disabled:cursor-not-allowed hover:bg-surface-raised text-txt-primary border border-border transition-colors cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
