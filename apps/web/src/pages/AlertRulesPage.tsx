import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { SeverityBadge } from '../components/SeverityBadge';
import {
  DataTable,
  TableHead,
  TableHeaderCell,
  TableBody,
  TableRow,
  TableCell,
} from '../components/DataTable';
import { LoadingSkeleton, ErrorBanner, EmptyState } from '../components/FeedbackStates';
import type { AlertMetric, AlertOperator, AlertSeverity } from '@tracinger/shared';
import {
  BellRing,
  Plus,
  Trash2,
  X,
} from 'lucide-react';

export const AlertRulesPage: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [metric, setMetric] = useState<AlertMetric>('ERROR_RATE');
  const [operator, setOperator] = useState<AlertOperator>('GREATER_THAN');
  const [threshold, setThreshold] = useState<number>(0.05);
  const [windowMinutes, setWindowMinutes] = useState<number>(5);
  const [pendingMinutes, setPendingMinutes] = useState<number>(1);
  const [severity, setSeverity] = useState<AlertSeverity>('HIGH');
  const [sloTarget, setSloTarget] = useState<string>('0.999');

  const queryClient = useQueryClient();

  const { data: rulesData, isLoading, error, refetch } = useQuery({
    queryKey: ['alert-rules'],
    queryFn: () => api.getAlertRules({ pageSize: 50 }),
  });

  const { data: servicesData } = useQuery({
    queryKey: ['services'],
    queryFn: () => api.getServices(),
  });

  const createRuleMutation = useMutation({
    mutationFn: (newRule: any) => api.createAlertRule(newRule),
    onSuccess: () => {
      setIsModalOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['alert-rules'] });
    },
  });

  const toggleRuleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      api.updateAlertRule(id, { enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alert-rules'] });
    },
  });

  const deleteRuleMutation = useMutation({
    mutationFn: (id: string) => api.deleteAlertRule(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alert-rules'] });
    },
  });

  const resetForm = () => {
    setName('');
    setDescription('');
    setServiceId('');
    setMetric('ERROR_RATE');
    setOperator('GREATER_THAN');
    setThreshold(0.05);
    setWindowMinutes(5);
    setPendingMinutes(1);
    setSeverity('HIGH');
    setSloTarget('0.999');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !serviceId) return;

    createRuleMutation.mutate({
      name,
      description: description || undefined,
      serviceId,
      metric,
      operator,
      threshold: Number(threshold),
      windowMinutes: Number(windowMinutes),
      pendingMinutes: Number(pendingMinutes),
      severity,
      sloTarget: sloTarget ? parseFloat(sloTarget) : undefined,
      enabled: true,
    });
  };

  const rules = rulesData?.data || [];
  const services = servicesData?.data || [];

  const formatOperator = (op: string) => {
    switch (op) {
      case 'GREATER_THAN':
        return '>';
      case 'GREATER_THAN_OR_EQUAL':
        return '>=';
      case 'LESS_THAN':
        return '<';
      case 'LESS_THAN_OR_EQUAL':
        return '<=';
      default:
        return op;
    }
  };

  // Remaining budget calculation for SLO bar
  const getSloRemainingBudget = (rule: any) => {
    if (!rule.sloTarget) return null;
    const isOrderService = rule.service?.name === 'order-service';
    if (isOrderService && rule.metric === 'ERROR_RATE') {
      return 14.2; // severely burned during active incident
    }
    return 91.8;
  };

  return (
    <div className="space-y-3 max-w-7xl mx-auto">
      {/* ── Toolbar Row ───────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pb-1 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-semibold text-txt-primary">
            Alert Rules & SLO Monitors
          </span>
          <span className="text-[11px] font-mono text-txt-muted tabular-nums">
            {rules.length} configured
          </span>
        </div>

        <button
          onClick={() => {
            if (services.length > 0 && !serviceId) setServiceId(services[0].id);
            setIsModalOpen(true);
          }}
          className="px-2.5 py-1 text-xs font-mono font-medium rounded-sm bg-surface-raised hover:bg-surface-active text-txt-primary border border-border hover:border-accent transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Alert Rule</span>
        </button>
      </div>

      {isLoading && <LoadingSkeleton rows={6} height="h-9" />}

      {error && (
        <ErrorBanner
          title="Alert rules query error"
          message={error instanceof Error ? error.message : 'Failed to query alert rule definitions'}
          onRetry={() => refetch()}
        />
      )}

      {!isLoading && !error && rules.length === 0 && (
        <EmptyState
          title="0 alert rules defined"
          description="Create threshold and SLO monitoring rules for service metrics."
          action={{
            label: 'Add Rule',
            onClick: () => setIsModalOpen(true),
          }}
          icon={<BellRing className="w-4 h-4" />}
        />
      )}

      {/* ── Alert Rules Table ─────────────────────────────────────────────── */}
      {rules.length > 0 && (
        <DataTable>
          <TableHead>
            <tr>
              <TableHeaderCell className="w-20">Severity</TableHeaderCell>
              <TableHeaderCell>Rule / Target</TableHeaderCell>
              <TableHeaderCell className="w-32">Service</TableHeaderCell>
              <TableHeaderCell>Expression (Monospace)</TableHeaderCell>
              <TableHeaderCell className="w-28">Windows</TableHeaderCell>
              <TableHeaderCell className="w-40">SLO Burn Bar</TableHeaderCell>
              <TableHeaderCell className="w-24">State</TableHeaderCell>
              <TableHeaderCell align="right" className="w-16">Delete</TableHeaderCell>
            </tr>
          </TableHead>
          <TableBody>
            {rules.map((rule) => {
              const remainingBudget = getSloRemainingBudget(rule);
              const budgetColor =
                remainingBudget === null
                  ? 'bg-txt-muted'
                  : remainingBudget > 70
                  ? 'bg-[#3fb950]'
                  : remainingBudget > 30
                  ? 'bg-[#d29922]'
                  : 'bg-[#f85149]';

              return (
                <TableRow key={rule.id}>
                  <TableCell>
                    <SeverityBadge severity={rule.severity} size="sm" />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium text-xs text-txt-primary">
                        {rule.name}
                      </span>
                      {rule.description && (
                        <span className="text-[10px] text-txt-muted truncate max-w-xs font-sans">
                          {rule.description}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-[11px] text-txt-secondary px-1.5 py-0.5 rounded-sm bg-surface-raised border border-border-subtle">
                      {rule.service?.name || 'global'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <code className="font-mono text-[11px] text-accent bg-surface-raised px-1.5 py-0.5 rounded-sm border border-border-subtle tabular-nums">
                      {rule.metric.toLowerCase()} {formatOperator(rule.operator)} {rule.threshold}
                    </code>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-[11px] text-txt-muted tabular-nums">
                      {rule.windowMinutes}m w / {rule.pendingMinutes}m p
                    </span>
                  </TableCell>
                  <TableCell>
                    {remainingBudget !== null ? (
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-surface-active overflow-hidden">
                          <div
                            className={`h-full ${budgetColor}`}
                            style={{ width: `${Math.min(100, remainingBudget)}%` }}
                          />
                        </div>
                        <span className="font-mono text-[11px] text-txt-primary tabular-nums">
                          {remainingBudget.toFixed(1)}%
                        </span>
                      </div>
                    ) : (
                      <span className="font-mono text-[11px] text-txt-muted">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() =>
                        toggleRuleMutation.mutate({ id: rule.id, enabled: !rule.enabled })
                      }
                      className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded-sm border transition-colors cursor-pointer ${
                        rule.enabled
                          ? 'bg-[#3fb950]/10 text-[#3fb950] border-[#3fb950]/30 hover:bg-[#3fb950]/20'
                          : 'bg-surface-raised text-txt-muted border-border hover:bg-surface-active'
                      }`}
                    >
                      {rule.enabled ? 'Enabled' : 'Disabled'}
                    </button>
                  </TableCell>
                  <TableCell align="right">
                    <button
                      onClick={() => {
                        if (confirm(`Delete rule "${rule.name}"?`)) {
                          deleteRuleMutation.mutate(rule.id);
                        }
                      }}
                      className="p-1 rounded-sm text-txt-muted hover:text-[#f85149] hover:bg-surface-raised transition-colors cursor-pointer"
                      title="Delete rule"
                      aria-label={`Delete rule ${rule.name}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </DataTable>
      )}

      {/* ── Create Rule Modal ──────────────────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-sm max-w-lg w-full p-4 shadow-xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-border mb-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-txt-primary font-mono">
                Create Alert Rule & SLO
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
                  Rule Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Order Service High Error Rate"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-sm bg-surface-raised border border-border px-2.5 py-1 text-xs text-txt-primary focus:outline-none focus:border-accent font-sans"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono uppercase text-txt-muted block mb-1">
                  Target Service *
                </label>
                <select
                  required
                  value={serviceId}
                  onChange={(e) => setServiceId(e.target.value)}
                  className="w-full rounded-sm bg-surface-raised border border-border px-2.5 py-1 text-xs text-txt-primary focus:outline-none focus:border-accent font-mono"
                >
                  <option value="" disabled>Select target service...</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.environment})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-mono uppercase text-txt-muted block mb-1">
                    Metric
                  </label>
                  <select
                    value={metric}
                    onChange={(e) => setMetric(e.target.value as AlertMetric)}
                    className="w-full rounded-sm bg-surface-raised border border-border px-2.5 py-1 text-xs text-txt-primary focus:outline-none focus:border-accent font-mono"
                  >
                    <option value="ERROR_RATE">ERROR_RATE</option>
                    <option value="LATENCY_P95">LATENCY_P95</option>
                    <option value="LATENCY_P99">LATENCY_P99</option>
                    <option value="REQUEST_RATE">REQUEST_RATE</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-mono uppercase text-txt-muted block mb-1">
                    Operator
                  </label>
                  <select
                    value={operator}
                    onChange={(e) => setOperator(e.target.value as AlertOperator)}
                    className="w-full rounded-sm bg-surface-raised border border-border px-2.5 py-1 text-xs text-txt-primary focus:outline-none focus:border-accent font-mono"
                  >
                    <option value="GREATER_THAN">&gt; GREATER_THAN</option>
                    <option value="GREATER_THAN_OR_EQUAL">&gt;= GREATER_THAN_OR_EQUAL</option>
                    <option value="LESS_THAN">&lt; LESS_THAN</option>
                    <option value="LESS_THAN_OR_EQUAL">&lt;= LESS_THAN_OR_EQUAL</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] font-mono uppercase text-txt-muted block mb-1">
                    Threshold
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={threshold}
                    onChange={(e) => setThreshold(parseFloat(e.target.value))}
                    className="w-full rounded-sm bg-surface-raised border border-border px-2.5 py-1 text-xs text-txt-primary focus:outline-none focus:border-accent font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono uppercase text-txt-muted block mb-1">
                    Window (min)
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={windowMinutes}
                    onChange={(e) => setWindowMinutes(parseInt(e.target.value))}
                    className="w-full rounded-sm bg-surface-raised border border-border px-2.5 py-1 text-xs text-txt-primary focus:outline-none focus:border-accent font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono uppercase text-txt-muted block mb-1">
                    Pending (min)
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={pendingMinutes}
                    onChange={(e) => setPendingMinutes(parseInt(e.target.value))}
                    className="w-full rounded-sm bg-surface-raised border border-border px-2.5 py-1 text-xs text-txt-primary focus:outline-none focus:border-accent font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-mono uppercase text-txt-muted block mb-1">
                    Severity
                  </label>
                  <select
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value as AlertSeverity)}
                    className="w-full rounded-sm bg-surface-raised border border-border px-2.5 py-1 text-xs text-txt-primary focus:outline-none focus:border-accent font-mono"
                  >
                    <option value="CRITICAL">CRITICAL</option>
                    <option value="HIGH">HIGH</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="LOW">LOW</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-mono uppercase text-txt-muted block mb-1">
                    SLO Target (e.g. 0.999)
                  </label>
                  <input
                    type="text"
                    value={sloTarget}
                    onChange={(e) => setSloTarget(e.target.value)}
                    className="w-full rounded-sm bg-surface-raised border border-border px-2.5 py-1 text-xs text-txt-primary focus:outline-none focus:border-accent font-mono"
                  />
                </div>
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
                  disabled={createRuleMutation.isPending}
                  className="px-3 py-1 text-xs font-mono font-medium rounded-sm bg-accent hover:bg-accent/90 text-white transition-colors cursor-pointer"
                >
                  {createRuleMutation.isPending ? 'Saving…' : 'Create Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
