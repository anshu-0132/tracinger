// ─────────────────────────────────────────────────────────────────────────────
// Shared Types — used across API, worker, web, and demo services
// ─────────────────────────────────────────────────────────────────────────────

export type AlertSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
export type AlertMetric =
  | 'ERROR_RATE'
  | 'P95_LATENCY'
  | 'P99_LATENCY'
  | 'P50_LATENCY'
  | 'REQUEST_RATE'
  | 'AVAILABILITY'
  | 'SLO_BURN_RATE'
  | 'TELEMETRY_ABSENT';
export type AlertOperator =
  | 'GREATER_THAN'
  | 'LESS_THAN'
  | 'GREATER_THAN_OR_EQUAL'
  | 'LESS_THAN_OR_EQUAL';
export type IncidentStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
export type NotificationStatus = 'PENDING' | 'DELIVERED' | 'FAILED' | 'RETRY';
export type ReplayRunStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface Service {
  id: string;
  name: string;
  environment: string;
  description?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ServiceHealth {
  service: Service;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  requestRate?: number;
  errorRate?: number;
  p50Latency?: number;
  p95Latency?: number;
  p99Latency?: number;
  lastSeenAt?: string;
  recentIncidentCount: number;
  activeIncidentCount: number;
}

export interface AlertRule {
  id: string;
  name: string;
  description?: string;
  serviceId: string;
  serviceName?: string;
  metric: AlertMetric;
  operator: AlertOperator;
  threshold: number;
  windowMinutes: number;
  pendingMinutes: number;
  severity: AlertSeverity;
  enabled: boolean;
  sloTarget?: number;
  sloBudgetMinutes?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Incident {
  id: string;
  fingerprint: string;
  serviceId: string;
  serviceName?: string;
  alertRuleId?: string;
  alertRuleName?: string;
  severity: AlertSeverity;
  status: IncidentStatus;
  title: string;
  description?: string;
  startedAt: string;
  detectedAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  assignee?: string;
  currentValue?: number;
  threshold?: number;
  evidenceJson?: RootCauseCandidate[];
  telemetryLinks?: TelemetryLink[];
  investigationNotes?: string;
  correlatedDeploymentId?: string;
  updatedAt: string;
}

export interface IncidentEvent {
  id: string;
  incidentId: string;
  type: string;
  fromStatus?: string;
  toStatus?: string;
  note?: string;
  metadata?: Record<string, unknown>;
  createdBy?: string;
  createdAt: string;
}

export interface Deployment {
  id: string;
  serviceName: string;
  environment: string;
  version: string;
  commitSha?: string;
  releaseNotes?: string;
  deployedAt: string;
  deployedBy?: string;
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Incident Intelligence
// ─────────────────────────────────────────────────────────────────────────────

export interface RootCauseCandidate {
  rank: number;
  score: number; // 0–100 normalized
  candidateType: 'service' | 'dependency' | 'deployment' | 'external';
  candidateId: string; // service name or deployment id
  candidateLabel: string;
  evidence: EvidenceItem[];
  missingEvidence: string[];
  explanation: string;
  telemetryLinks: TelemetryLink[];
}

export interface EvidenceItem {
  type:
    | 'error_spike'
    | 'latency_spike'
    | 'dependency_failure'
    | 'log_burst'
    | 'deployment_proximity'
    | 'shared_dependency'
    | 'telemetry_absent';
  weight: number; // raw contribution to score
  description: string;
  value?: number;
  threshold?: number;
  timestamp?: string;
}

export interface TelemetryLink {
  type: 'trace' | 'logs' | 'metrics' | 'grafana';
  label: string;
  url: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Replay Lab
// ─────────────────────────────────────────────────────────────────────────────

export interface ReplayScenario {
  id: string;
  name: string;
  description: string;
  durationSeconds: number;
  expectedSignals: string[];
  expectedAlert: string;
  faultType: 'http_5xx' | 'latency_spike' | 'dependency_timeout' | 'service_failure' | 'recovery';
  targetService: string;
  recoveryExpected: boolean;
}

export interface ReplayRun {
  id: string;
  scenarioId: string;
  scenarioName: string;
  status: ReplayRunStatus;
  startedAt?: string;
  completedAt?: string;
  incidentDetected?: boolean;
  detectionDelayMs?: number;
  incidentId?: string;
  expectedIncident: boolean;
  recovered?: boolean;
  recoveryDelayMs?: number;
  passed?: boolean;
  failureReason?: string;
  rawResult?: Record<string, unknown>;
  notes?: string;
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// API Pagination
// ─────────────────────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface ApiError {
  error: string;
  code?: string;
  details?: unknown;
  requestId?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Metrics / Telemetry
// ─────────────────────────────────────────────────────────────────────────────

export interface TimeSeriesPoint {
  timestamp: string;
  value: number;
}

export interface ServiceMetrics {
  serviceId: string;
  serviceName: string;
  environment: string;
  timeRange: { from: string; to: string };
  requestRate: TimeSeriesPoint[];
  errorRate: TimeSeriesPoint[];
  p50Latency: TimeSeriesPoint[];
  p95Latency: TimeSeriesPoint[];
  p99Latency: TimeSeriesPoint[];
}

export interface SpanInfo {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operationName: string;
  serviceName: string;
  startTime: string;
  duration: number; // ms
  status: 'ok' | 'error' | 'unset';
  statusMessage?: string;
  attributes: Record<string, string | number | boolean>;
}

export interface TraceInfo {
  traceId: string;
  rootSpan: SpanInfo;
  spans: SpanInfo[];
  totalDuration: number;
  hasErrors: boolean;
  services: string[];
}

export interface LogEntry {
  timestamp: string;
  level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  message: string;
  service?: string;
  traceId?: string;
  spanId?: string;
  labels?: Record<string, string>;
  [key: string]: unknown;
}
