import { describe, it, expect } from 'vitest';
import {
  compareValues,
  buildFingerprint,
  calculateSloBurnRate,
} from './alertEvaluator';

describe('Alert Evaluator — Unit Tests', () => {
  describe('compareValues', () => {
    it('evaluates GREATER_THAN correctly', () => {
      expect(compareValues(10, 'GREATER_THAN', 5)).toBe(true);
      expect(compareValues(5, 'GREATER_THAN', 5)).toBe(false);
      expect(compareValues(3, 'GREATER_THAN', 5)).toBe(false);
    });

    it('evaluates LESS_THAN correctly', () => {
      expect(compareValues(3, 'LESS_THAN', 5)).toBe(true);
      expect(compareValues(5, 'LESS_THAN', 5)).toBe(false);
      expect(compareValues(8, 'LESS_THAN', 5)).toBe(false);
    });

    it('evaluates GREATER_THAN_OR_EQUAL correctly', () => {
      expect(compareValues(5, 'GREATER_THAN_OR_EQUAL', 5)).toBe(true);
      expect(compareValues(6, 'GREATER_THAN_OR_EQUAL', 5)).toBe(true);
      expect(compareValues(4, 'GREATER_THAN_OR_EQUAL', 5)).toBe(false);
    });

    it('evaluates LESS_THAN_OR_EQUAL correctly', () => {
      expect(compareValues(5, 'LESS_THAN_OR_EQUAL', 5)).toBe(true);
      expect(compareValues(4, 'LESS_THAN_OR_EQUAL', 5)).toBe(true);
      expect(compareValues(6, 'LESS_THAN_OR_EQUAL', 5)).toBe(false);
    });

    it('returns false for unknown operators', () => {
      expect(compareValues(10, 'EQUALS', 10)).toBe(false);
    });
  });

  describe('buildFingerprint', () => {
    it('generates consistent sha256 32-character fingerprint', () => {
      const fp1 = buildFingerprint('svc-1', 'rule-1', 'ERROR_RATE');
      const fp2 = buildFingerprint('svc-1', 'rule-1', 'ERROR_RATE');

      expect(fp1).toBe(fp2);
      expect(fp1).toHaveLength(32);
    });

    it('produces distinct fingerprints for distinct dimensions', () => {
      const fp1 = buildFingerprint('svc-1', 'rule-1', 'ERROR_RATE');
      const fp2 = buildFingerprint('svc-2', 'rule-1', 'ERROR_RATE');
      const fp3 = buildFingerprint('svc-1', 'rule-2', 'ERROR_RATE');
      const fp4 = buildFingerprint('svc-1', 'rule-1', 'P95_LATENCY');

      expect(fp1).not.toBe(fp2);
      expect(fp1).not.toBe(fp3);
      expect(fp1).not.toBe(fp4);
    });
  });

  describe('calculateSloBurnRate', () => {
    it('calculates burn rate multiplier for error budget consumption', () => {
      // 99.9% target => budget = 0.001 (0.1%)
      // If errorRate = 0.001 (100% of allowed budget), over 1h vs 1h, burn rate is 1.0
      const burn = calculateSloBurnRate(0.001, 0.999, 60, 60);
      expect(burn).toBeCloseTo(1.0, 4);
    });

    it('returns 0 when error rate is 0', () => {
      const burn = calculateSloBurnRate(0, 0.999, 60, 43200);
      expect(burn).toBe(0);
    });

    it('reflects high burn rate when error rate significantly exceeds budget', () => {
      // errorRate = 0.05 (5%) vs 0.001 budget
      const burn = calculateSloBurnRate(0.05, 0.999, 60, 60);
      expect(burn).toBeCloseTo(50, 4);
    });
  });
});
