import { describe, it, expect } from 'vitest';
import { replayService } from './replay';

describe('Replay Lab Service — Unit Tests', () => {
  it('loads all predefined failure scenarios', () => {
    const scenarios = replayService.getScenarios();
    expect(scenarios.length).toBeGreaterThanOrEqual(4);

    const ids = scenarios.map((s) => s.id);
    expect(ids).toContain('http-5xx-burst');
    expect(ids).toContain('latency-spike');
    expect(ids).toContain('dependency-timeout');
    expect(ids).toContain('inventory-failure');
  });

  it('restricts fault injection targets only to demo microservices', () => {
    const scenarios = replayService.getScenarios();
    const allowedTargets = ['order-service', 'inventory-service'];

    for (const scenario of scenarios) {
      expect(allowedTargets).toContain(scenario.targetService);
      expect(scenario.durationSeconds).toBeGreaterThan(0);
      expect(scenario.expectedSignals.length).toBeGreaterThan(0);
    }
  });

  it('finds specific scenario by id', () => {
    const scenario = replayService.getScenario('http-5xx-burst');
    expect(scenario).toBeDefined();
    expect(scenario?.name).toBe('HTTP 5xx Burst');
    expect(scenario?.faultType).toBe('http_5xx');
  });

  it('returns undefined for non-existent scenario', () => {
    const scenario = replayService.getScenario('non-existent-scenario-xyz');
    expect(scenario).toBeUndefined();
  });
});
