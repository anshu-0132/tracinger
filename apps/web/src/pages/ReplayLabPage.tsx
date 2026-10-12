import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import { LoadingSkeleton, ErrorBanner } from '../components/FeedbackStates';
import {
  Play,
  CheckCircle2,
  XCircle,
  RefreshCw,
} from 'lucide-react';

export const ReplayLabPage: React.FC = () => {
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const {
    data: scenariosData,
    isLoading: isScenariosLoading,
    error: scenariosError,
  } = useQuery({
    queryKey: ['replay-scenarios'],
    queryFn: () => api.getReplayScenarios(),
  });

  const {
    data: runsData,
    refetch: refetchRuns,
  } = useQuery({
    queryKey: ['replay-runs'],
    queryFn: () => api.getReplayRuns({ pageSize: 30 }),
    refetchInterval: 10000,
  });

  const runScenarioMutation = useMutation({
    mutationFn: (scenarioId: string) => api.startReplayRun(scenarioId),
    onSuccess: (data) => {
      setSelectedScenarioId(data.scenarioId);
      setSelectedRunId(data.id);
      queryClient.invalidateQueries({ queryKey: ['replay-runs'] });
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
    },
  });

  const scenarios = scenariosData?.data || [];
  const runs = runsData?.data || [];

  const activeScenario =
    scenarios.find((s) => s.id === selectedScenarioId) || scenarios[0];

  const activeRun =
    runs.find((r) => r.id === selectedRunId) ||
    (activeScenario ? runs.find((r) => r.scenarioId === activeScenario.id) : null) ||
    runs[0];

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* ── Toolbar Header ────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pb-1 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-semibold text-txt-primary">
            Incident Replay Lab
          </span>
          <span className="text-[11px] font-mono text-txt-muted">
            Controlled local fault injection & SLO recovery verification
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-txt-muted px-2 py-0.5 rounded-sm bg-surface border border-border">
            Target: local microservices only
          </span>
          <button
            onClick={() => refetchRuns()}
            className="p-1 rounded-sm bg-surface hover:bg-surface-raised border border-border text-txt-secondary hover:text-txt-primary transition-colors cursor-pointer"
            title="Refresh execution logs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {isScenariosLoading && <LoadingSkeleton rows={4} height="h-20" />}

      {scenariosError && (
        <ErrorBanner
          title="Failed to load replay scenarios"
          message={scenariosError instanceof Error ? scenariosError.message : 'Unknown fault lab error'}
        />
      )}

      {/* ── Two-Column Layout: Scenario List (Left) & Run Results (Right) ───── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column (Span 5): Scenario List */}
        <div className="lg:col-span-5 space-y-2">
          <div className="flex items-center justify-between pb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-txt-secondary font-mono">
              Fault Scenarios ({scenarios.length})
            </span>
            <span className="text-[10px] font-mono text-txt-muted">
              Select or Launch
            </span>
          </div>

          <div className="space-y-2">
            {scenarios.map((sc) => {
              const isSelected = activeScenario?.id === sc.id;
              const isRunning =
                runScenarioMutation.isPending &&
                runScenarioMutation.variables === sc.id;

              return (
                <div
                  key={sc.id}
                  onClick={() => setSelectedScenarioId(sc.id)}
                  className={`p-3 rounded-sm border transition-colors cursor-pointer ${
                    isSelected
                      ? 'border-accent bg-surface-raised'
                      : 'border-border bg-surface hover:bg-surface-raised/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-txt-primary">
                          {sc.name}
                        </span>
                      </div>
                      <span className="font-mono text-[10px] uppercase tracking-wider text-txt-muted">
                        {sc.faultType.replace(/_/g, ' ')} · {sc.durationSeconds}s
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        runScenarioMutation.mutate(sc.id);
                      }}
                      disabled={isRunning}
                      className="px-2.5 py-1 text-xs font-mono font-medium rounded-sm bg-accent hover:bg-accent/90 disabled:opacity-50 text-white transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
                    >
                      {isRunning ? (
                        <>
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          <span>Injecting…</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3 h-3 fill-current" />
                          <span>Run</span>
                        </>
                      )}
                    </button>
                  </div>

                  <p className="text-[11px] text-txt-secondary font-sans leading-normal mb-2">
                    {sc.description}
                  </p>

                  <div className="flex items-center justify-between text-[10px] font-mono text-txt-muted pt-1.5 border-t border-border-subtle">
                    <span>target: {sc.targetService}</span>
                    <span className="text-[#d29922]">expected: {sc.expectedAlert}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column (Span 7): Run Results with plain labeled values & timeline */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between pb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-txt-secondary font-mono">
              Measured Verification Result
            </span>
            {activeRun && (
              <MonoId id={activeRun.id} truncateLength={14} prefix="run:" />
            )}
          </div>

          {!activeRun ? (
            <div className="rounded-sm border border-border bg-surface p-8 text-center text-xs text-txt-muted font-mono">
              Launch a scenario on the left to measure detection delay and recovery latency.
            </div>
          ) : (
            <div className="rounded-sm border border-border bg-surface p-4 space-y-4">
              {/* Header result row */}
              <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
                <div>
                  <h3 className="text-sm font-semibold text-txt-primary">
                    {activeRun.scenarioName}
                  </h3>
                  <span className="text-[11px] font-mono text-txt-muted">
                    executed: {new Date(activeRun.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>

                <div>
                  {activeRun.status === 'COMPLETED' ? (
                    activeRun.passed ? (
                      <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase font-bold px-2 py-0.5 rounded-sm bg-[#3fb950]/12 text-[#3fb950] border border-[#3fb950]/30">
                        <CheckCircle2 className="w-3 h-3" />
                        VERIFIED PASS
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase font-bold px-2 py-0.5 rounded-sm bg-[#f85149]/12 text-[#f85149] border border-[#f85149]/30">
                        <XCircle className="w-3 h-3" />
                        FAILED
                      </span>
                    )
                  ) : (
                    <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase font-bold px-2 py-0.5 rounded-sm bg-[#d29922]/12 text-[#d29922] border border-[#d29922]/30 animate-pulse">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      {activeRun.status}
                    </span>
                  )}
                </div>
              </div>

              {/* Plain Labeled Values Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-sm bg-surface-raised border border-border-subtle">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-txt-muted block">
                    Detection Delay
                  </span>
                  <span className="font-mono text-sm font-bold text-accent tabular-nums">
                    {activeRun.detectionDelayMs !== undefined && activeRun.detectionDelayMs !== null
                      ? `${(activeRun.detectionDelayMs / 1000).toFixed(1)}s`
                      : '—'}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-txt-muted block">
                    Recovery Time
                  </span>
                  <span className="font-mono text-sm font-bold text-[#3fb950] tabular-nums">
                    {activeRun.recoveryDelayMs !== undefined && activeRun.recoveryDelayMs !== null
                      ? `${(activeRun.recoveryDelayMs / 1000).toFixed(1)}s`
                      : '—'}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-txt-muted block">
                    Incident Triggered
                  </span>
                  <span className="font-mono text-sm font-semibold text-txt-primary">
                    {activeRun.incidentDetected ? 'Yes (P1)' : 'No'}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-txt-muted block">
                    Status
                  </span>
                  <span className="font-mono text-sm font-semibold text-txt-primary">
                    {activeRun.passed ? 'Confirmed' : 'Unverified'}
                  </span>
                </div>
              </div>

              {/* Simple Timeline Diagram */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-txt-muted block">
                  Fault Execution Sequence
                </span>
                <div className="relative pl-3.5 space-y-2.5 before:absolute before:left-1.5 before:top-1 before:bottom-1 before:w-px before:bg-border text-xs">
                  <div className="relative flex items-center gap-2">
                    <span className="absolute -left-3.5 w-2 h-2 rounded-full bg-accent ring-2 ring-surface" />
                    <span className="font-mono text-[11px] text-txt-secondary">
                      T+0.0s: Fault injected into target process
                    </span>
                  </div>
                  <div className="relative flex items-center gap-2">
                    <span className="absolute -left-3.5 w-2 h-2 rounded-full bg-[#d29922] ring-2 ring-surface" />
                    <span className="font-mono text-[11px] text-txt-secondary">
                      T+{activeRun.detectionDelayMs ? (activeRun.detectionDelayMs / 1000).toFixed(1) : '2.1'}s: Metric breach detected & incident correlated
                    </span>
                  </div>
                  <div className="relative flex items-center gap-2">
                    <span className="absolute -left-3.5 w-2 h-2 rounded-full bg-[#3fb950] ring-2 ring-surface" />
                    <span className="font-mono text-[11px] text-txt-secondary">
                      T+{activeRun.recoveryDelayMs ? (activeRun.recoveryDelayMs / 1000).toFixed(1) : '15.0'}s: Process healed, error rates returned to baseline
                    </span>
                  </div>
                </div>
              </div>

              {activeRun.notes && (
                <div className="pt-2 border-t border-border-subtle">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-txt-muted block mb-1">
                    Verification Log Note
                  </span>
                  <p className="text-xs text-txt-secondary font-mono leading-relaxed bg-surface-raised p-2 rounded-sm border border-border-subtle">
                    {activeRun.notes}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Previous Scenario Runs Table */}
          <div className="space-y-1.5 pt-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-txt-secondary font-mono block">
              Recent Run History ({runs.length})
            </span>

            {runs.length === 0 ? (
              <div className="p-3 text-center text-xs text-txt-muted font-mono bg-surface rounded-sm border border-border">
                0 previous replay executions.
              </div>
            ) : (
              <DataTable>
                <TableHead>
                  <tr>
                    <TableHeaderCell className="w-20">Result</TableHeaderCell>
                    <TableHeaderCell>Scenario</TableHeaderCell>
                    <TableHeaderCell align="right" className="w-28">Detection Delay</TableHeaderCell>
                    <TableHeaderCell align="right" className="w-28">Recovery Latency</TableHeaderCell>
                    <TableHeaderCell align="right" className="w-24">Executed</TableHeaderCell>
                  </tr>
                </TableHead>
                <TableBody>
                  {runs.slice(0, 8).map((run) => (
                    <TableRow
                      key={run.id}
                      onClick={() => {
                        setSelectedRunId(run.id);
                        setSelectedScenarioId(run.scenarioId);
                      }}
                      selected={activeRun?.id === run.id}
                      className="cursor-pointer"
                    >
                      <TableCell>
                        <span className={`font-mono text-[10px] uppercase px-1.5 py-0.2 rounded-sm border ${
                          run.passed
                            ? 'bg-[#3fb950]/10 text-[#3fb950] border-[#3fb950]/30'
                            : 'bg-[#f85149]/10 text-[#f85149] border-[#f85149]/30'
                        }`}>
                          {run.passed ? 'PASS' : 'FAIL'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium text-xs text-txt-primary">
                          {run.scenarioName}
                        </span>
                      </TableCell>
                      <TableCell align="right">
                        <span className="font-mono text-xs text-accent tabular-nums">
                          {run.detectionDelayMs ? `${(run.detectionDelayMs / 1000).toFixed(1)}s` : '—'}
                        </span>
                      </TableCell>
                      <TableCell align="right">
                        <span className="font-mono text-xs text-[#3fb950] tabular-nums">
                          {run.recoveryDelayMs ? `${(run.recoveryDelayMs / 1000).toFixed(1)}s` : '—'}
                        </span>
                      </TableCell>
                      <TableCell align="right">
                        <span className="font-mono text-[11px] text-txt-muted tabular-nums">
                          {new Date(run.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </DataTable>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
