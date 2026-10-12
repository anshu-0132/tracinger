/**
 * Replay Lab Service
 *
 * Manages predefined fault scenarios and their execution.
 * Fault injection targets ONLY the explicitly configured demo services.
 * This capability is disabled by default and requires ENABLE_FAULT_INJECTION=true.
 */

import axios from 'axios';
import { prisma } from '../config/database';
import { env } from '../config/env';
import { logger } from '../config/logger';
import type { ReplayScenario } from '@tracelens/shared';

const SCENARIOS: ReplayScenario[] = [
  {
    id: 'http-5xx-burst',
    name: 'HTTP 5xx Burst',
    description: 'Triggers a burst of HTTP 500 errors on the Order Service to test error-rate alerting.',
    durationSeconds: 60,
    expectedSignals: ['error_rate > 0.5', 'incident created with severity HIGH'],
    expectedAlert: 'Error rate spike on order-service',
    faultType: 'http_5xx',
    targetService: 'order-service',
    recoveryExpected: true,
  },
  {
    id: 'latency-spike',
    name: 'Latency Spike',
    description: 'Injects 3-second delays into Order Service responses to test p95 latency alerting.',
    durationSeconds: 90,
    expectedSignals: ['p95_latency > 2000ms', 'incident created with severity MEDIUM'],
    expectedAlert: 'p95 latency spike on order-service',
    faultType: 'latency_spike',
    targetService: 'order-service',
    recoveryExpected: true,
  },
  {
    id: 'dependency-timeout',
    name: 'Downstream Dependency Timeout',
    description: 'Makes Inventory Service return timeouts to Order Service, testing downstream-failure detection.',
    durationSeconds: 90,
    expectedSignals: ['downstream errors from inventory-service', 'dependency_failure evidence in incident'],
    expectedAlert: 'Downstream failure affecting order-service',
    faultType: 'dependency_timeout',
    targetService: 'inventory-service',
    recoveryExpected: true,
  },
  {
    id: 'inventory-failure',
    name: 'Inventory Service Failure',
    description: 'Brings the Inventory Service into a permanent failure mode to test service health detection.',
    durationSeconds: 120,
    expectedSignals: ['inventory-service error_rate = 1.0', 'incident CRITICAL'],
    expectedAlert: 'Inventory service failure',
    faultType: 'service_failure',
    targetService: 'inventory-service',
    recoveryExpected: true,
  },
  {
    id: 'recovery-test',
    name: 'Recovery After Failure',
    description: 'Triggers a brief 5xx burst then stops, verifying auto-resolution of the incident.',
    durationSeconds: 45,
    expectedSignals: ['incident opened', 'incident auto-resolved after recovery'],
    expectedAlert: 'Error rate recovers and incident resolves',
    faultType: 'recovery',
    targetService: 'order-service',
    recoveryExpected: true,
  },
];

class ReplayService {
  getScenarios(): ReplayScenario[] {
    return SCENARIOS;
  }

  getScenario(id: string): ReplayScenario | undefined {
    return SCENARIOS.find((s) => s.id === id);
  }

  async startRun(scenarioId: string): Promise<{ id: string; status: string }> {
    const scenario = this.getScenario(scenarioId);
    if (!scenario) throw new Error(`Unknown scenario: ${scenarioId}`);

    const run = await prisma.replayRun.create({
      data: {
        scenarioId,
        scenarioName: scenario.name,
        status: 'PENDING',
        expectedIncident: scenario.faultType !== 'recovery',
        notes: `Starting scenario: ${scenario.name}`,
      },
    });

    // Execute asynchronously — do not await
    this.executeScenario(run.id, scenario).catch((err) => {
      logger.error({ err, runId: run.id, scenarioId }, 'Replay scenario execution failed');
    });

    return { id: run.id, status: 'PENDING' };
  }

  private async executeScenario(runId: string, scenario: ReplayScenario): Promise<void> {
    const startedAt = new Date();

    await prisma.replayRun.update({
      where: { id: runId },
      data: { status: 'RUNNING', startedAt },
    });

    logger.info({ runId, scenarioId: scenario.id }, 'Replay scenario started');

    try {
      // ── Trigger fault ─────────────────────────────────────────────────────
      const targetUrl =
        scenario.targetService === 'order-service'
          ? env.ORDER_SERVICE_URL
          : env.INVENTORY_SERVICE_URL;

      await axios.post(
        `${targetUrl}/fault`,
        {
          type: scenario.faultType,
          durationSeconds: scenario.durationSeconds,
        },
        { timeout: 5000 },
      );

      // ── Wait for detection window ─────────────────────────────────────────
      const detectionWindowMs = Math.min(scenario.durationSeconds * 1000, 120_000);
      await sleep(detectionWindowMs);

      // ── Check if incident was created ─────────────────────────────────────
      const incidentCreatedAfter = new Date(startedAt.getTime() - 5_000);
      const incidents = await prisma.incident.findMany({
        where: {
          service: { name: { contains: scenario.targetService.replace('-service', '') } },
          startedAt: { gte: incidentCreatedAfter },
        },
        orderBy: { startedAt: 'asc' },
        take: 5,
      });

      const incidentDetected = incidents.length > 0;
      const detectionDelayMs = incidentDetected
        ? new Date(incidents[0].startedAt).getTime() - startedAt.getTime()
        : null;

      // ── Wait for recovery if expected ─────────────────────────────────────
      let recovered = false;
      let recoveryDelayMs: number | null = null;

      if (scenario.recoveryExpected && incidentDetected && incidents[0]) {
        const incidentId = incidents[0].id;
        const recoveryCheckMs = 90_000;
        await sleep(recoveryCheckMs);

        const updatedIncident = await prisma.incident.findUnique({
          where: { id: incidentId },
        });

        if (updatedIncident?.status === 'RESOLVED') {
          recovered = true;
          recoveryDelayMs = updatedIncident.resolvedAt
            ? updatedIncident.resolvedAt.getTime() - startedAt.getTime()
            : null;
        }
      }

      // ── Determine pass/fail ───────────────────────────────────────────────
      const expectedIncident = scenario.faultType !== 'recovery';
      const passed =
        expectedIncident === incidentDetected &&
        (!scenario.recoveryExpected || recovered);

      const failureReason = !passed
        ? !incidentDetected && expectedIncident
          ? 'Expected incident was not created within the detection window'
          : !recovered && scenario.recoveryExpected
            ? 'Incident was not auto-resolved within the recovery window'
            : 'Unexpected result'
        : undefined;

      await prisma.replayRun.update({
        where: { id: runId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          incidentDetected,
          detectionDelayMs,
          incidentId: incidents[0]?.id ?? null,
          recovered,
          recoveryDelayMs,
          passed,
          failureReason: failureReason ?? null,
          rawResult: {
            incidentCount: incidents.length,
            incidentIds: incidents.map((i: any) => i.id),
            scenario: scenario.id,
          },
        },
      });

      logger.info(
        { runId, passed, incidentDetected, recovered, detectionDelayMs },
        'Replay scenario completed',
      );
    } catch (err: any) {
      logger.error({ err, runId }, 'Replay scenario failed');

      await prisma.replayRun.update({
        where: { id: runId },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          passed: false,
          failureReason: `Execution error: ${err.message}`,
        },
      });
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const replayService = new ReplayService();
