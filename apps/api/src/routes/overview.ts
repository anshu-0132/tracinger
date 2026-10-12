import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { telemetryService } from '../services/telemetry';

export const overviewRouter = Router();

overviewRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const [services, openIncidents, recentIncidents, rules] = await Promise.all([
      prisma.service.findMany({ orderBy: { name: 'asc' } }),
      prisma.incident.count({ where: { status: { in: ['OPEN', 'ACKNOWLEDGED'] } } }),
      prisma.incident.count({
        where: { startedAt: { gte: oneHourAgo } },
      }),
      prisma.alertRule.count({ where: { enabled: true } }),
    ]);

    // Get health summary for each service from telemetry
    const serviceHealthList = await Promise.allSettled(
      services.map((svc: any) => telemetryService.getServiceHealthSummary(svc.name, svc.environment)),
    );

    const serviceHealth = services.map((svc: any, i: number) => {
      const result = serviceHealthList[i];
      if (result.status === 'fulfilled') return { service: svc, ...result.value };
      return {
        service: svc,
        status: 'unknown' as const,
        recentIncidentCount: 0,
        activeIncidentCount: 0,
      };
    });

    const healthyCounts = serviceHealth.reduce(
      (acc: Record<string, number>, s: any) => {
        acc[s.status] = (acc[s.status] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    res.json({
      timestamp: now.toISOString(),
      summary: {
        totalServices: services.length,
        openIncidents,
        recentIncidents,
        activeAlertRules: rules,
        healthy: healthyCounts['healthy'] ?? 0,
        degraded: healthyCounts['degraded'] ?? 0,
        unhealthy: healthyCounts['unhealthy'] ?? 0,
        unknown: healthyCounts['unknown'] ?? 0,
      },
      services: serviceHealth,
    });
  } catch (err) {
    next(err);
  }
});
