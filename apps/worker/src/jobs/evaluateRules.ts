/**
 * Alert rule evaluation job.
 * Loads all enabled rules from the database and evaluates each one.
 */

import type { PrismaClient } from '@prisma/client';
import type { Logger } from 'pino';
import axios from 'axios';
import crypto from 'crypto';

const PROMETHEUS_URL = process.env.PROMETHEUS_BASE_URL ?? 'http://localhost:9090';
const QUERY_TIMEOUT_MS = 8_000;

// Track pending breach state (in-memory, per worker process)
const pendingBreachSince = new Map<string, Date>();

function compareValues(current: number, operator: string, threshold: number): boolean {
  switch (operator) {
    case 'GREATER_THAN': return current > threshold;
    case 'LESS_THAN': return current < threshold;
    case 'GREATER_THAN_OR_EQUAL': return current >= threshold;
    case 'LESS_THAN_OR_EQUAL': return current <= threshold;
    default: return false;
  }
}

function buildFingerprint(serviceId: string, ruleId: string, metric: string): string {
  return crypto.createHash('sha256').update(`${serviceId}|${ruleId}|${metric}`).digest('hex').slice(0, 32);
}

async function instantQuery(promql: string): Promise<number | null> {
  try {
    const res = await axios.get(`${PROMETHEUS_URL}/api/v1/query`, {
      params: { query: promql },
      timeout: QUERY_TIMEOUT_MS,
    });
    const results: any[] = res.data?.data?.result ?? [];
    if (results.length === 0) return null;
    const v = parseFloat(results[0].value?.[1]);
    return isNaN(v) ? null : v;
  } catch {
    return null;
  }
}

async function getMetricValue(metric: string, serviceName: string, windowMinutes: number): Promise<number | null> {
  const label = `service_name="${serviceName}"`;
  const window = `${windowMinutes}m`;

  const queries: Record<string, string> = {
    ERROR_RATE: `sum(rate(http_server_request_duration_seconds_count{${label},http_response_status_code=~"5.."}[${window}])) / sum(rate(http_server_request_duration_seconds_count{${label}}[${window}]))`,
    P95_LATENCY: `histogram_quantile(0.95, sum(rate(http_server_request_duration_seconds_bucket{${label}}[${window}])) by (le)) * 1000`,
    P99_LATENCY: `histogram_quantile(0.99, sum(rate(http_server_request_duration_seconds_bucket{${label}}[${window}])) by (le)) * 1000`,
    P50_LATENCY: `histogram_quantile(0.50, sum(rate(http_server_request_duration_seconds_bucket{${label}}[${window}])) by (le)) * 1000`,
    REQUEST_RATE: `sum(rate(http_server_request_duration_seconds_count{${label}}[${window}]))`,
    AVAILABILITY: `1 - (sum(rate(http_server_request_duration_seconds_count{${label},http_response_status_code=~"5.."}[${window}])) / sum(rate(http_server_request_duration_seconds_count{${label}}[${window}])))`,
    TELEMETRY_ABSENT: `absent(http_server_request_duration_seconds_count{${label}})`,
  };

  const promql = queries[metric];
  if (!promql) return null;
  return instantQuery(promql);
}

export async function evaluateRule(prisma: PrismaClient, logger: Logger): Promise<void> {
  const rules = await prisma.alertRule.findMany({
    where: { enabled: true },
    include: { service: { select: { name: true, environment: true } } },
  });

  logger.debug({ ruleCount: rules.length }, 'Evaluating alert rules');

  for (const rule of rules) {
    try {
      const fingerprint = buildFingerprint(rule.serviceId, rule.id, rule.metric);
      const pendingKey = `${rule.id}:${fingerprint}`;

      // Get metric value
      let currentValue = await getMetricValue(rule.metric, rule.service.name, rule.windowMinutes);

      // SLO burn rate special case
      if (rule.metric === 'SLO_BURN_RATE' && rule.sloTarget && rule.sloBudgetMinutes) {
        const errorRate = await getMetricValue('ERROR_RATE', rule.service.name, rule.windowMinutes);
        if (errorRate !== null) {
          const errorBudget = 1 - rule.sloTarget;
          currentValue = errorBudget > 0
            ? (errorRate / errorBudget) * (rule.sloBudgetMinutes / rule.windowMinutes)
            : Infinity;
        }
      }

      // Absent metric — do not treat as zero
      if (currentValue === null) {
        pendingBreachSince.delete(pendingKey);
        continue;
      }

      const isBreaching = compareValues(currentValue, rule.operator, rule.threshold);

      // Check existing open incident
      const existing = await prisma.incident.findUnique({
        where: { fingerprint },
        select: { id: true, status: true },
      });

      // Recovery
      if (!isBreaching && existing && existing.status !== 'RESOLVED') {
        pendingBreachSince.delete(pendingKey);
        await prisma.$transaction([
          prisma.incident.update({
            where: { id: existing.id },
            data: { status: 'RESOLVED', resolvedAt: new Date() },
          }),
          prisma.incidentEvent.create({
            data: {
              incidentId: existing.id,
              type: 'status_change',
              fromStatus: existing.status,
              toStatus: 'RESOLVED',
              note: `Auto-resolved: ${rule.metric}=${currentValue.toFixed(4)} recovered below threshold ${rule.threshold}`,
              createdBy: 'worker',
            },
          }),
        ]);
        logger.info({ incidentId: existing.id, rule: rule.name }, 'Incident auto-resolved');
        continue;
      }

      if (!isBreaching) {
        pendingBreachSince.delete(pendingKey);
        continue;
      }

      // Update existing open incident
      if (existing && existing.status !== 'RESOLVED') {
        await prisma.incident.update({
          where: { id: existing.id },
          data: { currentValue, updatedAt: new Date() },
        });
        continue;
      }

      // Pending period check
      const now = new Date();
      if (!pendingBreachSince.has(pendingKey)) {
        pendingBreachSince.set(pendingKey, now);
        logger.debug({ rule: rule.name, pendingMinutes: rule.pendingMinutes }, 'Breach pending');
        continue;
      }

      const pendingSince = pendingBreachSince.get(pendingKey)!;
      const pendingMin = (now.getTime() - pendingSince.getTime()) / 60_000;
      if (pendingMin < rule.pendingMinutes) continue;

      pendingBreachSince.delete(pendingKey);

      // Check for correlated deployment
      const correlatedDeployment = await prisma.deployment.findFirst({
        where: {
          serviceName: rule.service.name,
          deployedAt: { gte: new Date(now.getTime() - 2 * 3600 * 1000) },
        },
        orderBy: { deployedAt: 'desc' },
      });

      try {
        const created = await prisma.incident.create({
          data: {
            fingerprint,
            serviceId: rule.serviceId,
            alertRuleId: rule.id,
            severity: rule.severity,
            status: 'OPEN',
            title: `${rule.name}: ${rule.metric} breach on ${rule.service.name}`,
            description: `${rule.metric} value ${currentValue.toFixed(4)} ${rule.operator.replace(/_/g, ' ').toLowerCase()} threshold ${rule.threshold}`,
            currentValue,
            threshold: rule.threshold,
            correlatedDeploymentId: correlatedDeployment?.id ?? null,
            events: {
              create: {
                type: 'status_change',
                toStatus: 'OPEN',
                note: `Incident opened: ${rule.metric}=${currentValue.toFixed(4)} (threshold: ${rule.threshold})`,
                createdBy: 'worker',
              },
            },
          },
        });
        logger.info({ incidentId: created.id, rule: rule.name, currentValue }, 'Incident created');
      } catch (err: any) {
        if (err.code === 'P2002') {
          logger.debug({ fingerprint }, 'Incident already exists — skipping duplicate');
        } else {
          throw err;
        }
      }
    } catch (err) {
      logger.error({ err, ruleId: rule.id, rule: rule.name }, 'Rule evaluation error');
      // Continue with other rules — one failure does not stop the cycle
    }
  }
}
