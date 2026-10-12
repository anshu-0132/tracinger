import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { env } from '../config/env';
import { telemetryService } from '../services/telemetry';

export const settingsRouter = Router();

// GET /api/settings/status
settingsRouter.get('/status', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    // Check database
    let dbStatus = 'ok';
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      dbStatus = 'error';
    }

    // Check telemetry backends
    const [prometheusOk, lokiOk, tempoOk] = await Promise.allSettled([
      telemetryService.checkPrometheus(),
      telemetryService.checkLoki(),
      telemetryService.checkTempo(),
    ]);

    res.json({
      timestamp: new Date().toISOString(),
      environment: env.NODE_ENV,
      faultInjectionEnabled: env.ENABLE_FAULT_INJECTION,
      alertEvalIntervalSeconds: env.ALERT_EVAL_INTERVAL_SECONDS,
      services: {
        database: dbStatus,
        prometheus: prometheusOk.status === 'fulfilled' ? prometheusOk.value : 'error',
        loki: lokiOk.status === 'fulfilled' ? lokiOk.value : 'error',
        tempo: tempoOk.status === 'fulfilled' ? tempoOk.value : 'error',
      },
      endpoints: {
        grafana: env.GRAFANA_BASE_URL,
        prometheus: env.PROMETHEUS_BASE_URL,
        loki: env.LOKI_BASE_URL,
        tempo: env.TEMPO_BASE_URL,
      },
    });
  } catch (err) {
    next(err);
  }
});
