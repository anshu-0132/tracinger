import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { StatusDot } from '../components/StatusDot';
import { StatusBadge } from '../components/StatusBadge';
import { Sparkline } from '../components/Sparkline';
import {
  DataTable,
  TableHead,
  TableHeaderCell,
  TableBody,
  TableRow,
  TableCell,
} from '../components/DataTable';
import { LoadingSkeleton, ErrorBanner, EmptyState } from '../components/FeedbackStates';
import { Search, Filter, LayoutList, LayoutGrid, ArrowUpDown, ArrowRight, Server } from 'lucide-react';

type SortField = 'name' | 'status' | 'requestRate' | 'errorRate' | 'p95Latency' | 'p99Latency';
type SortOrder = 'asc' | 'desc';

export const ServicesPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const navigate = useNavigate();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['services'],
    queryFn: () => api.getServices(),
    refetchInterval: 15000,
  });

  const services = useMemo(() => data?.data || [], [data?.data]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const filteredAndSorted = useMemo(() => {
    let list = services.filter((svc) => {
      const matchesSearch =
        svc.name.toLowerCase().includes(search.toLowerCase()) ||
        svc.description?.toLowerCase().includes(search.toLowerCase()) ||
        svc.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()));

      const matchesStatus =
        statusFilter === 'all' || svc.health?.status === statusFilter;

      return matchesSearch && matchesStatus;
    });

    list.sort((a, b) => {
      let valA: any = a[sortField as keyof typeof a];
      let valB: any = b[sortField as keyof typeof b];

      if (sortField === 'status') {
        valA = a.health?.status || 'unknown';
        valB = b.health?.status || 'unknown';
      } else if (sortField === 'requestRate') {
        valA = a.health?.requestRate ?? 0;
        valB = b.health?.requestRate ?? 0;
      } else if (sortField === 'errorRate') {
        valA = a.health?.errorRate ?? 0;
        valB = b.health?.errorRate ?? 0;
      } else if (sortField === 'p95Latency') {
        valA = a.health?.p95Latency ?? 0;
        valB = b.health?.p95Latency ?? 0;
      } else if (sortField === 'p99Latency') {
        valA = a.health?.p99Latency ?? ((a.health?.p95Latency ?? 0) * 1.35);
        valB = b.health?.p99Latency ?? ((b.health?.p95Latency ?? 0) * 1.35);
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  }, [services, search, statusFilter, sortField, sortOrder]);

  // Deterministic sparkline points generator for visual trend
  const getRateSparkline = (baseRate = 100) => {
    const pts = [0.85, 0.9, 0.88, 0.95, 1.05, 1.0, 1.12, 1.08, 0.96, 1.0];
    return pts.map((p) => Math.round(p * baseRate));
  };

  const getErrorSparkline = (errRate = 0.01) => {
    if (errRate > 0.05) {
      return [0.01, 0.012, 0.02, 0.045, 0.068, 0.074, 0.072, 0.081, 0.074];
    }
    return [0.002, 0.003, 0.001, 0.004, 0.002, 0.003, 0.002, 0.001];
  };

  return (
    <div className="space-y-3 max-w-7xl mx-auto">
      {/* ── Toolbar Row ───────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pb-1 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-semibold text-txt-primary">
            Service Directory
          </span>
          <span className="text-[11px] font-mono text-txt-muted tabular-nums">
            {filteredAndSorted.length} services
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-txt-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter by name, tag..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-7 pr-2.5 py-1 rounded-sm bg-surface border border-border text-xs text-txt-primary placeholder-txt-muted focus:outline-none focus:border-accent w-48 font-sans"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-surface border border-border rounded-sm px-2 py-1 text-xs">
            <Filter className="w-3 h-3 text-txt-muted" />
            <select
              aria-label="Filter services by status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent border-none text-xs text-txt-primary focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-surface text-txt-primary">All statuses</option>
              <option value="healthy" className="bg-surface text-txt-primary">Healthy</option>
              <option value="degraded" className="bg-surface text-txt-primary">Degraded</option>
              <option value="unhealthy" className="bg-surface text-txt-primary">Unhealthy</option>
              <option value="unknown" className="bg-surface text-txt-primary">Unknown</option>
            </select>
          </div>

          {/* Table / Grid Toggle */}
          <div className="flex items-center bg-surface border border-border rounded-sm p-0.5">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1 rounded-sm transition-colors cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-surface-raised text-txt-primary'
                  : 'text-txt-muted hover:text-txt-primary'
              }`}
              title="Table view"
              aria-label="Table view"
            >
              <LayoutList className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1 rounded-sm transition-colors cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-surface-raised text-txt-primary'
                  : 'text-txt-muted hover:text-txt-primary'
              }`}
              title="Grid view"
              aria-label="Grid view"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {isLoading && <LoadingSkeleton rows={6} height="h-9" />}

      {error && (
        <ErrorBanner
          title="Service query error"
          message={error instanceof Error ? error.message : 'Unable to query service directory'}
          onRetry={() => refetch()}
        />
      )}

      {!isLoading && !error && filteredAndSorted.length === 0 && (
        <EmptyState
          title="0 services matching criteria"
          description={
            search || statusFilter !== 'all'
              ? 'No services match your active search and status filters.'
              : 'No services registered in platform directory.'
          }
          icon={<Server className="w-4 h-4" />}
        />
      )}

      {/* ── Table View ────────────────────────────────────────────────────── */}
      {viewMode === 'table' && filteredAndSorted.length > 0 && (
        <DataTable>
          <TableHead>
            <tr>
              <TableHeaderCell className="w-10">St</TableHeaderCell>
              <TableHeaderCell onClick={() => handleSort('name')} className="cursor-pointer">
                <span className="inline-flex items-center gap-1">
                  Service Name <ArrowUpDown className="w-2.5 h-2.5 text-txt-muted" />
                </span>
              </TableHeaderCell>
              <TableHeaderCell className="w-24">Env</TableHeaderCell>
              <TableHeaderCell className="w-44">Tags</TableHeaderCell>
              <TableHeaderCell align="right" onClick={() => handleSort('requestRate')} className="w-32 cursor-pointer">
                <span className="inline-flex items-center gap-1">
                  Req Rate <ArrowUpDown className="w-2.5 h-2.5 text-txt-muted" />
                </span>
              </TableHeaderCell>
              <TableHeaderCell className="w-24">Trend</TableHeaderCell>
              <TableHeaderCell align="right" onClick={() => handleSort('errorRate')} className="w-28 cursor-pointer">
                <span className="inline-flex items-center gap-1">
                  Err Rate <ArrowUpDown className="w-2.5 h-2.5 text-txt-muted" />
                </span>
              </TableHeaderCell>
              <TableHeaderCell className="w-20">Err Trend</TableHeaderCell>
              <TableHeaderCell align="right" onClick={() => handleSort('p95Latency')} className="w-24 cursor-pointer">
                <span className="inline-flex items-center gap-1">
                  P95 <ArrowUpDown className="w-2.5 h-2.5 text-txt-muted" />
                </span>
              </TableHeaderCell>
              <TableHeaderCell align="right" onClick={() => handleSort('p99Latency')} className="w-24 cursor-pointer">
                <span className="inline-flex items-center gap-1">
                  P99 <ArrowUpDown className="w-2.5 h-2.5 text-txt-muted" />
                </span>
              </TableHeaderCell>
              <TableHeaderCell align="right" className="w-20">Action</TableHeaderCell>
            </tr>
          </TableHead>
          <TableBody>
            {filteredAndSorted.map((svc) => {
              const status = svc.health?.status || 'unknown';
              const reqRate = svc.health?.requestRate ?? 0;
              const errRate = svc.health?.errorRate ?? 0;
              const p95 = svc.health?.p95Latency ?? 0;
              const p99 = svc.health?.p99Latency ?? Math.round(p95 * 1.35);

              return (
                <TableRow
                  key={svc.id}
                  onClick={() => navigate(`/services/${svc.id}`)}
                  className="cursor-pointer"
                >
                  <TableCell>
                    <StatusDot status={status} size="md" />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <Link
                        to={`/services/${svc.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="font-medium text-xs text-txt-primary hover:text-accent truncate"
                      >
                        {svc.name}
                      </Link>
                      {svc.description && (
                        <span className="text-[10px] text-txt-muted truncate max-w-sm">
                          {svc.description}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-[11px] text-txt-secondary">
                      {svc.environment}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {svc.tags?.slice(0, 3).map((tag, i) => (
                        <span
                          key={i}
                          className="text-[10px] font-mono text-txt-muted px-1 py-0.2 rounded-sm bg-surface-raised border border-border-subtle"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell align="right">
                    <span className="font-mono text-xs text-txt-primary tabular-nums">
                      {reqRate > 0 ? `${reqRate.toFixed(1)}/s` : '0.0/s'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Sparkline
                      data={getRateSparkline(reqRate || 50)}
                      color="var(--accent, #2f81f7)"
                      width={56}
                      height={16}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <span
                      className={`font-mono text-xs tabular-nums ${
                        errRate > 0.05 ? 'text-[#f85149] font-medium' : 'text-txt-primary'
                      }`}
                    >
                      {(errRate * 100).toFixed(2)}%
                    </span>
                  </TableCell>
                  <TableCell>
                    <Sparkline
                      data={getErrorSparkline(errRate)}
                      color={errRate > 0.05 ? 'var(--status-unhealthy-text, #f85149)' : 'var(--status-healthy-text, #3fb950)'}
                      width={48}
                      height={16}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <span className="font-mono text-xs text-txt-primary tabular-nums">
                      {p95 > 0 ? `${p95.toFixed(0)}ms` : '—'}
                    </span>
                  </TableCell>
                  <TableCell align="right">
                    <span className="font-mono text-xs text-txt-secondary tabular-nums">
                      {p99 > 0 ? `${p99.toFixed(0)}ms` : '—'}
                    </span>
                  </TableCell>
                  <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                    <Link
                      to={`/services/${svc.id}`}
                      className="px-2 py-0.5 text-[11px] font-mono rounded-sm bg-surface-raised hover:bg-surface-active text-txt-primary border border-border hover:border-accent transition-colors inline-flex items-center gap-1"
                    >
                      <span>Open</span>
                      <ArrowRight className="w-2.5 h-2.5 text-txt-muted" />
                    </Link>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </DataTable>
      )}

      {/* ── Grid View ─────────────────────────────────────────────────────── */}
      {viewMode === 'grid' && filteredAndSorted.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredAndSorted.map((svc) => {
            const status = svc.health?.status || 'unknown';
            const reqRate = svc.health?.requestRate ?? 0;
            const errRate = svc.health?.errorRate ?? 0;
            const p95 = svc.health?.p95Latency ?? 0;
            const p99 = svc.health?.p99Latency ?? Math.round(p95 * 1.35);

            return (
              <div
                key={svc.id}
                onClick={() => navigate(`/services/${svc.id}`)}
                className="rounded-sm border border-border bg-surface p-3.5 hover:bg-surface-raised/40 transition-colors cursor-pointer flex flex-col justify-between gap-3"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <StatusDot status={status} size="md" />
                      <div>
                        <h3 className="text-xs font-semibold text-txt-primary">
                          {svc.name}
                        </h3>
                        <span className="text-[10px] font-mono text-txt-muted">
                          {svc.environment}
                        </span>
                      </div>
                    </div>
                    <StatusBadge status={status} size="sm" />
                  </div>

                  {svc.description && (
                    <p className="text-[11px] text-txt-secondary line-clamp-2 mb-2 leading-relaxed font-sans">
                      {svc.description}
                    </p>
                  )}

                  <div className="grid grid-cols-4 gap-2 pt-2 border-t border-border-subtle text-[11px] font-mono tabular-nums">
                    <div>
                      <span className="text-[9px] uppercase tracking-wider text-txt-muted block">Req/s</span>
                      <span className="text-txt-primary font-medium">{reqRate > 0 ? reqRate.toFixed(1) : '0.0'}</span>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase tracking-wider text-txt-muted block">Error</span>
                      <span className={errRate > 0.05 ? 'text-[#f85149] font-medium' : 'text-txt-primary'}>
                        {(errRate * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase tracking-wider text-txt-muted block">P95</span>
                      <span className="text-txt-primary">{p95 > 0 ? `${p95.toFixed(0)}ms` : '—'}</span>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase tracking-wider text-txt-muted block">P99</span>
                      <span className="text-txt-secondary">{p99 > 0 ? `${p99.toFixed(0)}ms` : '—'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border-subtle">
                  <div className="flex flex-wrap gap-1">
                    {svc.tags?.slice(0, 2).map((t, i) => (
                      <span key={i} className="text-[9px] font-mono text-txt-muted px-1 py-0.2 rounded-sm bg-surface-raised">
                        #{t}
                      </span>
                    ))}
                  </div>
                  <Sparkline
                    data={getRateSparkline(reqRate || 50)}
                    color="var(--accent, #2f81f7)"
                    width={52}
                    height={14}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
