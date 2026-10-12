import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../config/logger';

export const incidentsRouter = Router();

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['OPEN', 'ACKNOWLEDGED', 'RESOLVED']).optional(),
  severity: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']).optional(),
  serviceId: z.string().optional(),
  sortBy: z.enum(['startedAt', 'severity', 'status', 'updatedAt']).default('startedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

const patchStatusSchema = z.object({
  status: z.enum(['ACKNOWLEDGED', 'RESOLVED']),
  note: z.string().max(2000).optional(),
  assignee: z.string().max(200).optional(),
});

// GET /api/incidents
incidentsRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, pageSize, status, severity, serviceId, sortBy, sortOrder } =
      listQuerySchema.parse(req.query);

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (severity) where.severity = severity;
    if (serviceId) where.serviceId = serviceId;

    const [incidents, total] = await Promise.all([
      prisma.incident.findMany({
        where,
        include: {
          service: { select: { name: true, environment: true } },
          alertRule: { select: { name: true } },
          correlatedDeployment: {
            select: { id: true, version: true, deployedAt: true },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.incident.count({ where }),
    ]);

    res.json({ data: incidents, total, page, pageSize, hasMore: page * pageSize < total });
  } catch (err) {
    next(err);
  }
});

// GET /api/incidents/:id
incidentsRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const incident = await prisma.incident.findUnique({
      where: { id },
      include: {
        service: { select: { name: true, environment: true } },
        alertRule: { select: { name: true, metric: true, threshold: true } },
        correlatedDeployment: true,
        events: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!incident) throw new AppError(404, 'NOT_FOUND', 'Incident not found');
    res.json(incident);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/incidents/:id/status
incidentsRouter.patch('/:id/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { status, note, assignee } = patchStatusSchema.parse(req.body);
    const incident = await prisma.incident.findUnique({ where: { id } });
    if (!incident) throw new AppError(404, 'NOT_FOUND', 'Incident not found');

    if (incident.status === 'RESOLVED') {
      throw new AppError(409, 'ALREADY_RESOLVED', 'Incident is already resolved');
    }
    if (incident.status === 'ACKNOWLEDGED' && status === 'ACKNOWLEDGED') {
      throw new AppError(409, 'ALREADY_ACKNOWLEDGED', 'Incident is already acknowledged');
    }

    const now = new Date();
    const update: Record<string, unknown> = { status };
    if (status === 'ACKNOWLEDGED') update.acknowledgedAt = now;
    if (status === 'RESOLVED') update.resolvedAt = now;
    if (assignee) update.assignee = assignee;

    const [updated] = await prisma.$transaction([
      prisma.incident.update({
        where: { id },
        data: update,
        include: {
          service: { select: { name: true } },
        },
      }),
      prisma.incidentEvent.create({
        data: {
          incidentId: id,
          type: 'status_change',
          fromStatus: incident.status,
          toStatus: status,
          note: note ?? null,
          createdBy: assignee ?? 'user',
        },
      }),
    ]);

    logger.info(
      { incidentId: id, from: incident.status, to: status },
      'Incident status changed',
    );

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// GET /api/incidents/:id/events
incidentsRouter.get('/:id/events', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const incident = await prisma.incident.findUnique({ where: { id } });
    if (!incident) throw new AppError(404, 'NOT_FOUND', 'Incident not found');

    const events = await prisma.incidentEvent.findMany({
      where: { incidentId: id },
      orderBy: { createdAt: 'asc' },
    });

    res.json({ data: events, total: events.length });
  } catch (err) {
    next(err);
  }
});

// POST /api/incidents/:id/notes
incidentsRouter.post('/:id/notes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const noteSchema = z.object({
      note: z.string().min(1).max(3000),
      createdBy: z.string().max(200).optional().default('engineer'),
    });
    const { note, createdBy } = noteSchema.parse(req.body);

    const incident = await prisma.incident.findUnique({ where: { id } });
    if (!incident) throw new AppError(404, 'NOT_FOUND', 'Incident not found');

    const event = await prisma.incidentEvent.create({
      data: {
        incidentId: id,
        type: 'note',
        note,
        createdBy,
      },
    });

    // Append to investigation notes
    const currentNotes = incident.investigationNotes ? `${incident.investigationNotes}\n\n` : '';
    await prisma.incident.update({
      where: { id },
      data: { investigationNotes: `${currentNotes}[${new Date().toISOString()}] ${createdBy}: ${note}` },
    });

    res.status(201).json(event);
  } catch (err) {
    next(err);
  }
});

// POST /api/incidents/:id/analyze
incidentsRouter.post('/:id/analyze', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const incident = await prisma.incident.findUnique({
      where: { id },
      include: { service: true, alertRule: true },
    });
    if (!incident) throw new AppError(404, 'NOT_FOUND', 'Incident not found');

    const { rankRootCauses } = await import('../services/intelligenceEngine');
    const { telemetryService } = await import('../services/telemetry');

    const health = await telemetryService.getServiceHealthSummary(
      incident.service.name,
      incident.service.environment,
    );

    // Look back 60 minutes for deployments
    const sixtyMinsAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentDeployments = await prisma.deployment.findMany({
      where: {
        deployedAt: { gte: sixtyMinsAgo },
      },
      orderBy: { deployedAt: 'desc' },
    });

    const ranking = rankRootCauses({
      incident: incident as any,
      errorRate: health.errorRate ?? null,
      p95Latency: health.p95Latency ?? null,
      logBurstDetected: (health.errorRate ?? 0) > 0.05,
      dependencyFailures: [],
      recentDeployments: recentDeployments as any,
      telemetryAbsent: health.status === 'unknown',
    });

    // Correlate with closest deployment if candidate found
    const depCandidate = ranking.candidates.find((c) => c.candidateType === 'deployment');
    const correlatedDeploymentId = depCandidate?.candidateId ?? incident.correlatedDeploymentId;

    const updated = await prisma.incident.update({
      where: { id },
      data: {
        evidenceJson: ranking.candidates as any,
        correlatedDeploymentId,
      },
      include: {
        service: true,
        alertRule: true,
        correlatedDeployment: true,
        events: { orderBy: { createdAt: 'asc' } },
      },
    });

    await prisma.incidentEvent.create({
      data: {
        incidentId: id,
        type: 'intelligence_reanalyzed',
        note: `Incident intelligence re-evaluated: ${ranking.candidates.length} root-cause candidates ranked (top: ${ranking.candidates[0]?.candidateLabel ?? 'none'})`,
        createdBy: 'Tracinger Intelligence Engine',
      },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

