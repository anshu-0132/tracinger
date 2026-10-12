import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
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
import { GitCommit, Plus, AlertTriangle, X, ArrowRight } from 'lucide-react';

export const DeploymentsPage: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [serviceName, setServiceName] = useState('');
  const [version, setVersion] = useState('');
  const [commitSha, setCommitSha] = useState('');
  const [releaseNotes, setReleaseNotes] = useState('');
  const [deployedBy, setDeployedBy] = useState('');

  const queryClient = useQueryClient();

  const { data: deploymentsData, isLoading, error, refetch } = useQuery({
    queryKey: ['deployments'],
    queryFn: () => api.getDeployments({ pageSize: 50 }),
  });

  const { data: servicesData } = useQuery({
    queryKey: ['services'],
    queryFn: () => api.getServices(),
  });

  const { data: incidentsData } = useQuery({
    queryKey: ['incidents-recent'],
    queryFn: () => api.getIncidents({ pageSize: 20 }),
  });

  const createDeploymentMutation = useMutation({
    mutationFn: (newDep: any) => api.createDeployment(newDep),
    onSuccess: () => {
      setIsModalOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['deployments'] });
    },
  });

  const resetForm = () => {
    setServiceName('');
    setVersion('');
    setCommitSha('');
    setReleaseNotes('');
    setDeployedBy('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceName || !version) return;

    createDeploymentMutation.mutate({
      serviceName,
      environment: 'production',
      version,
      commitSha: commitSha || undefined,
      releaseNotes: releaseNotes || undefined,
      deployedBy: deployedBy || 'engineer',
      deployedAt: new Date().toISOString(),
    });
  };

  const deployments = deploymentsData?.data || [];
  const services = servicesData?.data || [];
  const incidents = incidentsData?.data || [];

  // Map correlated incidents to deployments
  const getCorrelatedIncident = (depVersion: string, depService: string) => {
    return incidents.find(
      (inc) =>
        inc.correlatedDeployment?.version === depVersion ||
        (inc.service.name === depService && inc.title.toLowerCase().includes(depVersion.toLowerCase()))
    );
  };

  return (
    <div className="space-y-3 max-w-7xl mx-auto">
      {/* ── Toolbar ───────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pb-1 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-semibold text-txt-primary">
            Deployment Change Timeline
          </span>
          <span className="text-[11px] font-mono text-txt-muted tabular-nums">
            {deployments.length} releases logged
          </span>
        </div>

        <button
          onClick={() => {
            if (services.length > 0 && !serviceName) setServiceName(services[0].name);
            setIsModalOpen(true);
          }}
          className="px-2.5 py-1 text-xs font-mono font-medium rounded-sm bg-surface-raised hover:bg-surface-active text-txt-primary border border-border hover:border-accent transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Register Deployment</span>
        </button>
      </div>

      {isLoading && <LoadingSkeleton rows={6} height="h-9" />}

      {error && (
        <ErrorBanner
          title="Deployment timeline error"
          message={error instanceof Error ? error.message : 'Unable to query deployment history'}
          onRetry={() => refetch()}
        />
      )}

      {!isLoading && !error && deployments.length === 0 && (
        <EmptyState
          title="0 deployment records found"
          description="Register deployment release markers to enable automatic degradation correlation."
          action={{
            label: 'Register Deployment',
            onClick: () => setIsModalOpen(true),
          }}
          icon={<GitCommit className="w-4 h-4" />}
        />
      )}

      {/* ── Deployment Table with Degradation Correlation Marker ──────────── */}
      {deployments.length > 0 && (
        <DataTable>
          <TableHead>
            <tr>
              <TableHeaderCell className="w-24">Version</TableHeaderCell>
              <TableHeaderCell className="w-28">Commit SHA</TableHeaderCell>
              <TableHeaderCell className="w-32">Service</TableHeaderCell>
              <TableHeaderCell>Release Notes / Context</TableHeaderCell>
              <TableHeaderCell className="w-52">Degradation Correlation</TableHeaderCell>
              <TableHeaderCell className="w-28">Author</TableHeaderCell>
              <TableHeaderCell align="right" className="w-32">Deployed At</TableHeaderCell>
            </tr>
          </TableHead>
          <TableBody>
            {deployments.map((dep) => {
              const correlatedInc = getCorrelatedIncident(dep.version, dep.serviceName);

              return (
                <TableRow
                  key={dep.id}
                  className={correlatedInc ? 'bg-[#f85149]/5 border-l-2 border-l-[#f85149]' : ''}
                >
                  <TableCell>
                    <span className="font-mono text-xs font-semibold text-txt-primary">
                      {dep.version}
                    </span>
                  </TableCell>
                  <TableCell>
                    {dep.commitSha ? (
                      <MonoId id={dep.commitSha} truncateLength={8} />
                    ) : (
                      <span className="font-mono text-[11px] text-txt-muted">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-[11px] text-txt-secondary px-1.5 py-0.5 rounded-sm bg-surface-raised border border-border-subtle">
                      {dep.serviceName}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-txt-secondary font-sans line-clamp-1">
                      {dep.releaseNotes || 'Automated deployment artifact'}
                    </span>
                  </TableCell>
                  <TableCell>
                    {correlatedInc ? (
                      <Link
                        to={`/incidents/${correlatedInc.id}`}
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm bg-[#f85149]/12 border border-[#f85149]/35 text-[#f85149] font-mono text-[10px] hover:bg-[#f85149]/20 transition-colors"
                      >
                        <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                        <span className="truncate max-w-[140px]">Degradation: {correlatedInc.title}</span>
                        <ArrowRight className="w-2.5 h-2.5 shrink-0" />
                      </Link>
                    ) : (
                      <span className="font-mono text-[10px] text-txt-muted">
                        No degradation detected
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-[11px] text-txt-secondary">
                      {dep.deployedBy || 'ci/cd'}
                    </span>
                  </TableCell>
                  <TableCell align="right">
                    <span className="font-mono text-[11px] text-txt-muted tabular-nums">
                      {new Date(dep.deployedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </DataTable>
      )}

      {/* ── Register Deployment Modal ─────────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-sm max-w-lg w-full p-4 shadow-xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-border mb-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-txt-primary font-mono">
                Register Deployment Event
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-txt-muted hover:text-txt-primary p-0.5"
                aria-label="Close"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="text-[10px] font-mono uppercase text-txt-muted block mb-1">
                  Service *
                </label>
                <select
                  required
                  value={serviceName}
                  onChange={(e) => setServiceName(e.target.value)}
                  className="w-full rounded-sm bg-surface-raised border border-border px-2.5 py-1 text-xs text-txt-primary focus:outline-none focus:border-accent font-mono"
                >
                  <option value="" disabled>Select target service...</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.name}>
                      {s.name} ({s.environment})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-mono uppercase text-txt-muted block mb-1">
                    Version Tag *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. v1.4.3"
                    value={version}
                    onChange={(e) => setVersion(e.target.value)}
                    className="w-full rounded-sm bg-surface-raised border border-border px-2.5 py-1 text-xs text-txt-primary focus:outline-none focus:border-accent font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono uppercase text-txt-muted block mb-1">
                    Commit SHA
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 8a2f91c"
                    value={commitSha}
                    onChange={(e) => setCommitSha(e.target.value)}
                    className="w-full rounded-sm bg-surface-raised border border-border px-2.5 py-1 text-xs text-txt-primary focus:outline-none focus:border-accent font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-mono uppercase text-txt-muted block mb-1">
                  Author / Committer
                </label>
                <input
                  type="text"
                  placeholder="e.g. ci-cd or engineer handle"
                  value={deployedBy}
                  onChange={(e) => setDeployedBy(e.target.value)}
                  className="w-full rounded-sm bg-surface-raised border border-border px-2.5 py-1 text-xs text-txt-primary focus:outline-none focus:border-accent font-mono"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono uppercase text-txt-muted block mb-1">
                  Release Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Summary of code changes, PR links, configuration changes..."
                  value={releaseNotes}
                  onChange={(e) => setReleaseNotes(e.target.value)}
                  className="w-full rounded-sm bg-surface-raised border border-border p-2 text-xs text-txt-primary focus:outline-none focus:border-accent font-sans"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-2.5 py-1 text-xs font-mono rounded-sm bg-surface hover:bg-surface-raised text-txt-secondary border border-border transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createDeploymentMutation.isPending}
                  className="px-3 py-1 text-xs font-mono font-medium rounded-sm bg-accent hover:bg-accent/90 text-white transition-colors cursor-pointer"
                >
                  {createDeploymentMutation.isPending ? 'Logging…' : 'Register Deployment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
