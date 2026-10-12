import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';

describe('Health Endpoints Integration Tests', () => {
  const app = createApp();

  it('GET /api/health/live returns 200 with status ok', async () => {
    const res = await request(app).get('/api/health/live');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.timestamp).toBeDefined();
  });

  it('GET /api/replay/scenarios returns list of available scenarios', async () => {
    const res = await request(app).get('/api/replay/scenarios');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('returns 404 for unknown endpoints with structured error', async () => {
    const res = await request(app).get('/api/non-existent-route-xyz');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });
});
