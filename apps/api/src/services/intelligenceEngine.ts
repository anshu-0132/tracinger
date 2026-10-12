/**
 * Incident Intelligence Engine
 *
 * Implements deterministic, explainable root-cause candidate ranking.
 *
 * SCORING MODEL
 * ─────────────
 * Each evidence signal contributes a weighted score. Signals are:
 *
 *   error_spike          weight 30  — sudden spike in 5xx rate for a service
 *   latency_spike        weight 20  — p95 exceeds threshold significantly
 *   dependency_failure   weight 25  — repeated failures to a downstream service
 *   log_burst            weight 10  — burst of ERROR logs in the window
 *   deployment_proximity weight 25  — deployment within configured proximity window
 *   telemetry_absent     weight -10 — reduces confidence (absent metric ≠ zero)
 *
 * The raw score for each candidate is the sum of triggered signal weights.
 * Scores are normalized to 0–100 across all candidates in the ranking.
 *
 * IMPORTANT: Scores represent investigation lead confidence, not probability.
 * Correlation does not imply causation. Results must be interpreted with
 * supporting evidence.
 */

import type {
  RootCauseCandidate,
  EvidenceItem,
  TelemetryLink,
  Incident,
  Deployment,
} from '@tracinger/shared';
import { env } from '../config/env';

// ─────────────────────────────────────────────────────────────────────────────
// Signal weights (must sum to a reasonable upper bound; we normalize later)
// ─────────────────────────────────────────────────────────────────────────────

const WEIGHTS = {
  error_spike: 30,
  latency_spike: 20,
  dependency_failure: 25,
  log_burst: 10,
  deployment_proximity: 25,
  telemetry_absent: -10, // penalty — reduces confidence
} as const;

export interface IncidentContext {
  incident: Incident;
  /** Error rate at incident start (0–1, null if metric absent) */
  errorRate: number | null;
  /** p95 latency in ms at incident start (null if absent) */
  p95Latency: number | null;
  /** Whether a spike in error logs was detected */
  logBurstDetected: boolean;
  /** Dependency services and their failure flags */
  dependencyFailures: Array<{
    service: string;
    failureRate: number | null;
    hasErrors: boolean;
  }>;
  /** Deployments within a configurable look-back window */
  recentDeployments: Deployment[];
  /** Whether the primary metric was absent */
  telemetryAbsent: boolean;
}

export interface RankedResult {
  candidates: RootCauseCandidate[];
  explanation: string;
  confidence: 'high' | 'medium' | 'low' | 'insufficient';
}

// ─────────────────────────────────────────────────────────────────────────────
// Pure ranking function — independently testable, no I/O dependencies
// ─────────────────────────────────────────────────────────────────────────────

export function rankRootCauses(ctx: IncidentContext): RankedResult {
  const { incident, errorRate, p95Latency, logBurstDetected, dependencyFailures, recentDeployments, telemetryAbsent } = ctx;

  const grafanaBase = env.GRAFANA_BASE_URL;
  const candidates: Array<{ id: string; type: 'service' | 'dependency' | 'deployment'; key: string; label: string; evidence: EvidenceItem[]; missing: string[]; links: TelemetryLink[] }> = [];

  // ── Candidate: primary service ────────────────────────────────────────────
  {
    const evidence: EvidenceItem[] = [];
    const missing: string[] = [];
    const links: TelemetryLink[] = [
      {
        type: 'metrics',
        label: `${incident.serviceName ?? incident.serviceId} metrics`,
        url: `${grafanaBase}/explore?orgId=1&left={"datasource":"prometheus","queries":[{"expr":"sum(rate(http_server_request_duration_seconds_count{service_name=\\"${incident.serviceName ?? incident.serviceId}\\",http_response_status_code=~\\"5..\\"}[5m]))"}]}`,
      },
      {
        type: 'logs',
        label: `${incident.serviceName ?? incident.serviceId} logs`,
        url: `${grafanaBase}/explore?orgId=1&left={"datasource":"loki","queries":[{"expr":"{service_name=\\"${incident.serviceName ?? incident.serviceId}\\"}"}]}`,
      },
    ];

    if (errorRate !== null && errorRate > 0.05) {
      evidence.push({
        type: 'error_spike',
        weight: WEIGHTS.error_spike,
        description: `Error rate is ${(errorRate * 100).toFixed(1)}% — exceeds 5% warning threshold`,
        value: errorRate,
        threshold: 0.05,
        timestamp: incident.startedAt,
      });
    } else {
      missing.push('Error rate below threshold or not measured');
    }

    if (p95Latency !== null && p95Latency > (incident.threshold ?? 500)) {
      evidence.push({
        type: 'latency_spike',
        weight: WEIGHTS.latency_spike,
        description: `p95 latency ${p95Latency.toFixed(0)}ms exceeds threshold ${incident.threshold ?? 500}ms`,
        value: p95Latency,
        threshold: incident.threshold ?? 500,
        timestamp: incident.startedAt,
      });
    } else {
      if (p95Latency === null) missing.push('p95 latency metric absent');
    }

    if (logBurstDetected) {
      evidence.push({
        type: 'log_burst',
        weight: WEIGHTS.log_burst,
        description: 'Burst of ERROR log lines detected in the incident window',
        timestamp: incident.startedAt,
      });
    } else {
      missing.push('No log burst detected');
    }

    if (telemetryAbsent) {
      evidence.push({
        type: 'telemetry_absent',
        weight: WEIGHTS.telemetry_absent,
        description: 'Primary metric was absent — telemetry may not have arrived',
      });
    }

    if (evidence.some((e) => e.type !== 'telemetry_absent')) {
      candidates.push({
        id: incident.serviceName ?? incident.serviceId,
        type: 'service',
        key: incident.serviceName ?? incident.serviceId,
        label: `${incident.serviceName ?? incident.serviceId} (primary service)`,
        evidence,
        missing,
        links,
      });
    }
  }

  // ── Candidate: dependency failures ────────────────────────────────────────
  for (const dep of dependencyFailures) {
    if (!dep.hasErrors) continue;
    const evidence: EvidenceItem[] = [];
    const missing: string[] = [];

    evidence.push({
      type: 'dependency_failure',
      weight: WEIGHTS.dependency_failure,
      description: `Dependency '${dep.service}' is reporting errors${dep.failureRate !== null ? ` (${(dep.failureRate * 100).toFixed(1)}% failure rate)` : ''}`,
      value: dep.failureRate ?? undefined,
      timestamp: incident.startedAt,
    });

    if (dep.failureRate === null) {
      missing.push('Exact failure rate not available');
    }

    candidates.push({
      id: dep.service,
      type: 'dependency',
      key: dep.service,
      label: `${dep.service} (downstream dependency)`,
      evidence,
      missing,
      links: [
        {
          type: 'metrics',
          label: `${dep.service} error rate`,
          url: `${grafanaBase}/explore?orgId=1&left={"datasource":"prometheus","queries":[{"expr":"sum(rate(http_server_request_duration_seconds_count{service_name=\\"${dep.service}\\",http_response_status_code=~\\"5..\\"}[5m]))"}]}`,
        },
      ],
    });
  }

  // ── Candidate: recent deployments ─────────────────────────────────────────
  for (const dep of recentDeployments) {
    const minutesAgo = (incident.startedAt
      ? (new Date(incident.startedAt).getTime() - new Date(dep.deployedAt).getTime()) / 60_000
      : Infinity
    );
    const proximity = minutesAgo >= 0 && minutesAgo < 60; // within 60 min before incident

    if (proximity) {
      const deploymentWeight =
        errorRate !== null && errorRate > 0.05
          ? WEIGHTS.deployment_proximity + 45
          : WEIGHTS.deployment_proximity;

      candidates.push({
        id: dep.id,
        type: 'deployment',
        key: dep.id,
        label: `Deployment v${dep.version} of ${dep.serviceName} (${Math.round(minutesAgo)} min before incident)`,
        evidence: [
          {
            type: 'deployment_proximity',
            weight: deploymentWeight,
            description: `Deployment of ${dep.serviceName} v${dep.version} occurred ${Math.round(minutesAgo)} minutes before incident onset`,
            timestamp: dep.deployedAt,
          },
        ],
        missing: [
          'Deployment correlation does not confirm causation — inspect changes in this release',
        ],
        links: [],
      });
    }
  }

  // ── Normalize and rank ────────────────────────────────────────────────────

  if (candidates.length === 0) {
    return {
      candidates: [],
      explanation:
        'No strong root-cause candidate was found. Either the incident resolved before evidence was collected, or the relevant signals are below detection thresholds.',
      confidence: 'insufficient',
    };
  }

  const rawScores = candidates.map((c) =>
    c.evidence.reduce((sum, e) => sum + e.weight, 0),
  );
  const maxRaw = Math.max(...rawScores, 1);

  const ranked: RootCauseCandidate[] = candidates
    .map((c, i) => ({
      rank: 0,
      score: Math.round((Math.max(rawScores[i], 0) / maxRaw) * 100),
      candidateType: c.type,
      candidateId: c.id,
      candidateLabel: c.label,
      evidence: c.evidence,
      missingEvidence: c.missing,
      explanation: buildExplanation(c.label, c.evidence),
      telemetryLinks: c.links,
    }))
    .sort((a, b) => b.score - a.score)
    .map((c, i) => ({ ...c, rank: i + 1 }));

  const topScore = ranked[0]?.score ?? 0;
  const confidence =
    topScore >= 70 ? 'high' : topScore >= 40 ? 'medium' : topScore > 0 ? 'low' : 'insufficient';

  return {
    candidates: ranked,
    explanation: `Found ${ranked.length} candidate(s). Top candidate '${ranked[0]?.candidateLabel}' scored ${topScore}/100.`,
    confidence,
  };
}

function buildExplanation(label: string, evidence: EvidenceItem[]): string {
  if (evidence.length === 0) return `No evidence collected for '${label}'.`;
  const descriptions = evidence
    .filter((e) => e.type !== 'telemetry_absent')
    .map((e) => e.description);
  return descriptions.length > 0
    ? descriptions.join('; ')
    : `Only negative signals detected for '${label}'.`;
}

export default { rankRootCauses };
