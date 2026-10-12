/**
 * Alert Evaluator Service
 *
 * Compares configured alert rule thresholds against live Prometheus metrics.
 * Implements:
 *   - Comparison operators
 *   - Pending period (consecutive breach required before incident fires)
 *   - Recovery detection
 *   - Incident fingerprinting and deduplication
 *   - SLO burn-rate evaluation
 *
 * FINGERPRINT DESIGN
 * ──────────────────
 * fingerprint = sha256(serviceId + "|" + ruleId + "|" + metric)
 * One incident per (service, rule) combination at a time.
 * Unique constraint on the incidents table guarantees idempotency across
 * concurrent worker restarts.
 */
import type { AlertRule } from '@prisma/client';
export declare function compareValues(current: number, operator: string, threshold: number): boolean;
export declare function buildFingerprint(serviceId: string, ruleId: string, metric: string): string;
/**
 * Evaluate SLO burn rate.
 * burn_rate = (error_rate / error_budget) × (window_minutes / slo_budget_minutes)
 * Returns the burn rate multiplier. A value > 1 means the budget is depleting
 * faster than it is earned.
 */
export declare function calculateSloBurnRate(errorRate: number, sloTarget: number, windowMinutes: number, sloBudgetMinutes: number): number;
export declare function evaluateRule(rule: AlertRule & {
    service: {
        name: string;
        environment: string;
    };
}): Promise<void>;
//# sourceMappingURL=alertEvaluator.d.ts.map