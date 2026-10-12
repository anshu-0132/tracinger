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
import type { RootCauseCandidate, Incident, Deployment } from '@tracelens/shared';
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
export declare function rankRootCauses(ctx: IncidentContext): RankedResult;
declare const _default: {
    rankRootCauses: typeof rankRootCauses;
};
export default _default;
//# sourceMappingURL=intelligenceEngine.d.ts.map