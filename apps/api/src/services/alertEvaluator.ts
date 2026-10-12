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

import crypto from 'crypto';
import { prisma } from '../config/database';
import { telemetryService } from './telemetry';
import { rankRootCauses } from './intelligenceEngine';
import { logger } from '../config/logger';
import type { AlertRule } from '@prisma/client';

// Track pending state between evaluations (in-memory; safe for single worker)
const pendingBreachSince = new Map<string, Date>();

export function compareValues(current: number, operator: string, threshold: number): boolean {
  switch (operator) {
    case 'GREATER_THAN':
      return current > threshold;
    case 'LESS_THAN':
      return current < threshold;
    case 'GREATER_THAN_OR_EQUAL':
      return current >= threshold;
    case 'LESS_THAN_OR_EQUAL':
      return current <= threshold;
    default:
      return false;
  }
}

export function buildFingerprint(serviceId: string, ruleId: string, metric: string): string {
  return crypto
    .createHash('sha256')
    .update(`${serviceId}|${ruleId}|${metric}`)
    .digest('hex')
    .slice(0, 32);
}

/**
 * Evaluate SLO burn rate.
 * burn_rate = (error_rate / error_budget) × (window_minutes / slo_budget_minutes)
 * Returns the burn rate multiplier. A value > 1 means the budget is depleting
 * faster than it is earned.
 */
export function calculateSloBurnRate(
  errorRate: number,
  sloTarget: number,
  windowMinutes: number,
  sloBudgetMinutes: number,
): number {
  const errorBudget = 1 - sloTarget; // e.g. 0.001 for 99.9%
  if (errorBudget <= 0) return Infinity;
  // Annualised burn rate
  const burn = (errorRate / errorBudget) * (sloBudgetMinutes / windowMinutes);
  return burn;
}

export async function evaluateRule(rule: AlertRule & { service: { name: string; environment: string } }): Promise<void> {
  const { id: ruleId, serviceId, metric, operator, threshold, pendingMinutes } = rule;
  const fingerprint = buildFingerprint(serviceId, ruleId, metric);
  const pendingKey = `${ruleId}:${fingerprint}`;

  // ── Get current metric value ──────────────────────────────────────────────
  let currentValue: number | null = null;

  if (metric === 'TELEMETRY_ABSENT') {
    // Special case — check if we have any data at all in the last window
    const requestRate = await telemetryService.evaluateMetric(
      'REQUEST_RATE',
      rule.service.name,
      rule.windowMinutes,
    );
    currentValue = requestRate === null ? 1 : 0; // 1 = absent
  } else if (metric === 'SLO_BURN_RATE' && rule.sloTarget && rule.sloBudgetMinutes) {
    const errorRate = await telemetryService.evaluateMetric('ERROR_RATE', rule.service.name, rule.windowMinutes);
    if (errorRate !== null) {
      currentValue = calculateSloBurnRate(errorRate, rule.sloTarget, rule.windowMinutes, rule.sloBudgetMinutes);
    }
  } else {
    currentValue = await telemetryService.evaluateMetric(metric, rule.service.name, rule.windowMinutes);
  }

  // Telemetry absent — do not treat as zero; skip evaluation
  if (currentValue === null) {
    logger.debug(
      { ruleId, metric, service: rule.service.name },
      'Metric absent — skipping evaluation (not treating as zero)',
    );
    pendingBreachSince.delete(pendingKey);
    return;
  }

  const isBreaching = compareValues(currentValue, operator, threshold);

  // ── Check existing open incident ──────────────────────────────────────────
  const existingIncident = await prisma.incident.findUnique({
    where: { fingerprint },
    select: { id: true, status: true, startedAt: true },
  });

  // ── Recovery detection ────────────────────────────────────────────────────
  if (!isBreaching && existingIncident && existingIncident.status !== 'RESOLVED') {
    // Clear pending state
    pendingBreachSince.delete(pendingKey);

    // Resolve the incident
    await prisma.$transaction([
      prisma.incident.update({
        where: { id: existingIncident.id },
        data: { status: 'RESOLVED', resolvedAt: new Date() },
      }),
      prisma.incidentEvent.create({
        data: {
          incidentId: existingIncident.id,
          type: 'status_change',
          fromStatus: existingIncident.status,
          toStatus: 'RESOLVED',
          note: `Auto-resolved: metric ${metric} recovered to ${currentValue.toFixed(4)} (threshold: ${threshold})`,
          createdBy: 'worker',
        },
      }),
    ]);

    logger.info(
      { incidentId: existingIncident.id, metric, currentValue },
      'Incident auto-resolved — metric recovered',
    );
    return;
  }

  // ── No breach — ensure pending state is clear ─────────────────────────────
  if (!isBreaching) {
    pendingBreachSince.delete(pendingKey);
    return;
  }

  // ── Breach detected ───────────────────────────────────────────────────────

  // If already open, just update the current value
  if (existingIncident && existingIncident.status !== 'RESOLVED') {
    await prisma.incident.update({
      where: { id: existingIncident.id },
      data: { currentValue },
    });
    return;
  }

  // Pending period: require breach to persist for `pendingMinutes`
  const now = new Date();
  if (!pendingBreachSince.has(pendingKey)) {
    pendingBreachSince.set(pendingKey, now);
    logger.debug({ ruleId, pendingMinutes }, 'Breach entered pending period');
    return;
  }

  const pendingSince = pendingBreachSince.get(pendingKey)!;
  const pendingDurationMin = (now.getTime() - pendingSince.getTime()) / 60_000;

  if (pendingDurationMin < pendingMinutes) {
    logger.debug(
      { ruleId, pendingDurationMin, pendingMinutes },
      'Breach still in pending period',
    );
    return;
  }

  // ── Create incident ───────────────────────────────────────────────────────
  pendingBreachSince.delete(pendingKey);

  // Build evidence via intelligence engine
  const recentDeployments = await prisma.deployment
    .findMany({
      where: {
        serviceName: rule.service.name,
        deployedAt: { gte: new Date(now.getTime() - 2 * 3600 * 1000) }, // 2h look-back
      },
      orderBy: { deployedAt: 'desc' },
    })
    .then((deps: any[]) =>
      deps.map((d: any) => ({
        id: d.id,
        serviceName: d.serviceName,
        environment: d.environment,
        version: d.version,
        commitSha: d.commitSha ?? undefined,
        releaseNotes: d.releaseNotes ?? undefined,
        deployedAt: d.deployedAt.toISOString(),
        deployedBy: d.deployedBy ?? undefined,
        createdAt: d.createdAt.toISOString(),
      })),
    );

  const rankedResult = rankRootCauses({
    incident: {
      id: 'pending',
      fingerprint,
      serviceId,
      serviceName: rule.service.name,
      severity: rule.severity,
      status: 'OPEN',
      title: '',
      startedAt: now.toISOString(),
      detectedAt: now.toISOString(),
      threshold,
      currentValue,
      updatedAt: now.toISOString(),
    },
    errorRate: metric === 'ERROR_RATE' ? currentValue : null,
    p95Latency: metric === 'P95_LATENCY' ? currentValue : null,
    logBurstDetected: false, // would require Loki query — skipped for perf
    dependencyFailures: [],
    recentDeployments,
    telemetryAbsent: false,
  });

  // Find if there was a deployment shortly before
  const correlatedDeployment = recentDeployments.find((d: any) => {
    const deltaMin = (now.getTime() - new Date(d.deployedAt).getTime()) / 60_000;
    return deltaMin >= 0 && deltaMin <= 60;
  });

  try {
    const created = await prisma.incident.create({
      data: {
        fingerprint,
        serviceId,
        alertRuleId: ruleId,
        severity: rule.severity,
        status: 'OPEN',
        title: `${rule.name}: ${metric} breach on ${rule.service.name}`,
        description: `Metric ${metric} value ${currentValue.toFixed(4)} ${operator.replace(/_/g, ' ').toLowerCase()} threshold ${threshold}`,
        currentValue,
        threshold,
        evidenceJson: rankedResult.candidates as any,
        correlatedDeploymentId: correlatedDeployment?.id ?? null,
        events: {
          create: {
            type: 'status_change',
            fromStatus: null,
            toStatus: 'OPEN',
            note: `Incident auto-opened: ${metric}=${currentValue.toFixed(4)} (threshold: ${threshold})`,
            createdBy: 'worker',
          },
        },
      },
    });

    logger.info(
      {
        incidentId: created.id,
        fingerprint,
        metric,
        currentValue,
        threshold,
        service: rule.service.name,
      },
      'Incident created',
    );
  } catch (err: any) {
    if (err.code === 'P2002') {
      // Race condition — another worker beat us to it; this is safe to ignore
      logger.debug({ fingerprint }, 'Incident already created by concurrent worker — skipping');
    } else {
      throw err;
    }
  }
}
