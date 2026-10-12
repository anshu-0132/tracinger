import { describe, it, expect } from 'vitest';
import { rankRootCauses, IncidentContext } from './intelligenceEngine';
import type { Incident, Deployment } from '@tracinger/shared';

describe('Incident Intelligence Engine — rankRootCauses', () => {
  const baseIncident: Incident = {
    id: 'inc-1',
    fingerprint: 'fp-order-service-err',
    serviceId: 'svc-order',
    serviceName: 'order-service',
    severity: 'HIGH',
    status: 'OPEN',
    title: 'High HTTP 5xx Error Rate',
    startedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    detectedAt: new Date(Date.now() - 9 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const sampleDeployment: Deployment = {
    id: 'dep-1',
    serviceName: 'order-service',
    environment: 'production',
    version: 'v2.4.1',
    commitSha: '8f9b2a1c',
    releaseNotes: 'Connection pool optimization',
    deployedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(), // 5 mins before incident
    createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
  };

  it('ranks deployment as #1 candidate when deployment occurred immediately before incident with error spike', () => {
    const ctx: IncidentContext = {
      incident: baseIncident,
      errorRate: 0.18, // 18% error spike
      p95Latency: 800,
      logBurstDetected: true,
      dependencyFailures: [],
      recentDeployments: [sampleDeployment],
      telemetryAbsent: false,
    };

    const result = rankRootCauses(ctx);

    expect(result.candidates.length).toBeGreaterThan(0);
    const topCandidate = result.candidates[0];
    expect(topCandidate.candidateType).toBe('deployment');
    expect(topCandidate.candidateId).toBe('dep-1');
    expect(topCandidate.score).toBeGreaterThanOrEqual(70);
    expect(topCandidate.evidence.some((e) => e.type === 'deployment_proximity')).toBe(true);
  });

  it('ranks downstream dependency when dependency failure rate is high', () => {
    const ctx: IncidentContext = {
      incident: baseIncident,
      errorRate: 0.08,
      p95Latency: 1500,
      logBurstDetected: false,
      dependencyFailures: [
        {
          service: 'inventory-service',
          failureRate: 0.45,
          hasErrors: true,
        },
      ],
      recentDeployments: [],
      telemetryAbsent: false,
    };

    const result = rankRootCauses(ctx);

    const depCandidate = result.candidates.find((c) => c.candidateId === 'inventory-service');
    expect(depCandidate).toBeDefined();
    expect(depCandidate?.candidateType).toBe('dependency');
    expect(depCandidate?.evidence.some((e) => e.type === 'dependency_failure')).toBe(true);
  });

  it('is completely deterministic: identical inputs yield identical rankings and scores', () => {
    const ctx: IncidentContext = {
      incident: baseIncident,
      errorRate: 0.25,
      p95Latency: 1200,
      logBurstDetected: true,
      dependencyFailures: [
        { service: 'payment-gateway', failureRate: 0.1, hasErrors: true },
      ],
      recentDeployments: [sampleDeployment],
      telemetryAbsent: false,
    };

    const run1 = rankRootCauses(ctx);
    const run2 = rankRootCauses(ctx);

    expect(run1).toEqual(run2);
  });

  it('normalizes scores between 0 and 100', () => {
    const ctx: IncidentContext = {
      incident: baseIncident,
      errorRate: 0.85,
      p95Latency: 5000,
      logBurstDetected: true,
      dependencyFailures: [
        { service: 'dep-a', failureRate: 0.9, hasErrors: true },
        { service: 'dep-b', failureRate: 0.8, hasErrors: true },
      ],
      recentDeployments: [sampleDeployment],
      telemetryAbsent: false,
    };

    const result = rankRootCauses(ctx);

    for (const c of result.candidates) {
      expect(c.score).toBeGreaterThanOrEqual(0);
      expect(c.score).toBeLessThanOrEqual(100);
    }
  });

  it('correctly handles telemetry absence and flags missing evidence', () => {
    const ctx: IncidentContext = {
      incident: baseIncident,
      errorRate: null,
      p95Latency: null,
      logBurstDetected: false,
      dependencyFailures: [],
      recentDeployments: [],
      telemetryAbsent: true,
    };

    const result = rankRootCauses(ctx);

    expect(result.confidence).toBe('insufficient');
  });
});
