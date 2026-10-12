import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { telemetryService } from '../services/telemetry';
import { AppError } from '../middleware/errorHandler';

export const servicesRouter = Router();

const timeRangeSchema = z.object({
  from: z.string().optional().default('now-1h'),
  to: z.string().optional().default('now'),
  step: z.string().optional().default('1m'),
});

// GET /api/services
servicesRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { environment } = req.query;
    const services = await prisma.service.findMany({
      where: environment ? { environment: String(environment) } : undefined,
      orderBy: { name: 'asc' },
    });

    // Enrich with health from telemetry
    const healthResults = await Promise.allSettled(
      services.map((s: any) => telemetryService.getServiceHealthSummary(s.name, s.environment)),
    );

    const enriched = services.map((svc: any, i: number) => {
      const r = healthResults[i];
      if (r.status === 'fulfilled') {
        return { ...svc, health: r.value };
      }
      return { ...svc, health: { status: 'unknown', recentIncidentCount: 0, activeIncidentCount: 0 } };
    });

    res.json({ data: enriched, total: enriched.length });
  } catch (err) {
    next(err);
  }
});

// GET /api/services/:id
servicesRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const service = await prisma.service.findUnique({
      where: { id },
      include: {
        _count: { select: { incidents: true, alertRules: true } },
      },
    });
    if (!service) throw new AppError(404, 'NOT_FOUND', 'Service not found');

    const health = await telemetryService.getServiceHealthSummary(service.name, service.environment);
    res.json({ ...service, health });
  } catch (err) {
    next(err);
  }
});

// GET /api/services/:id/metrics
servicesRouter.get('/:id/metrics', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const service = await prisma.service.findUnique({ where: { id } });
    if (!service) throw new AppError(404, 'NOT_FOUND', 'Service not found');

    const { from, to, step } = timeRangeSchema.parse(req.query);
    const metrics = await telemetryService.getServiceMetrics(
      service.name,
      service.environment,
      from,
      to,
      step,
    );
    res.json(metrics);
  } catch (err) {
    next(err);
  }
});

// GET /api/services/:id/traces
servicesRouter.get('/:id/traces', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const service = await prisma.service.findUnique({ where: { id } });
    if (!service) throw new AppError(404, 'NOT_FOUND', 'Service not found');

    const { from, to } = timeRangeSchema.parse(req.query);
    const traces = await telemetryService.searchTraces(service.name, from, to);
    res.json({ data: traces, total: traces.length });
  } catch (err) {
    next(err);
  }
});
