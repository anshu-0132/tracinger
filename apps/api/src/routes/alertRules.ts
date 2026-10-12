import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';

export const alertRulesRouter = Router();

const createRuleSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  serviceId: z.string().cuid(),
  metric: z.enum([
    'ERROR_RATE',
    'P95_LATENCY',
    'P99_LATENCY',
    'P50_LATENCY',
    'REQUEST_RATE',
    'AVAILABILITY',
    'SLO_BURN_RATE',
    'TELEMETRY_ABSENT',
  ]),
  operator: z.enum(['GREATER_THAN', 'LESS_THAN', 'GREATER_THAN_OR_EQUAL', 'LESS_THAN_OR_EQUAL']),
  threshold: z.number().finite(),
  windowMinutes: z.number().int().min(1).max(1440).default(5),
  pendingMinutes: z.number().int().min(0).max(60).default(1),
  severity: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']).default('MEDIUM'),
  enabled: z.boolean().default(true),
  sloTarget: z.number().min(0).max(1).optional(),
  sloBudgetMinutes: z.number().int().min(1).optional(),
});

const patchRuleSchema = createRuleSchema.partial().omit({ serviceId: true });

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  serviceId: z.string().optional(),
  enabled: z.enum(['true', 'false']).optional(),
});

// GET /api/alert-rules
alertRulesRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, pageSize, serviceId, enabled } = listQuerySchema.parse(req.query);
    const where: Record<string, unknown> = {};
    if (serviceId) where.serviceId = serviceId;
    if (enabled !== undefined) where.enabled = enabled === 'true';

    const [rules, total] = await Promise.all([
      prisma.alertRule.findMany({
        where,
        include: { service: { select: { name: true, environment: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.alertRule.count({ where }),
    ]);

    res.json({
      data: rules,
      total,
      page,
      pageSize,
      hasMore: page * pageSize < total,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/alert-rules
alertRulesRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = createRuleSchema.parse(req.body);
    const service = await prisma.service.findUnique({ where: { id: body.serviceId } });
    if (!service) throw new AppError(404, 'NOT_FOUND', 'Service not found');

    const rule = await prisma.alertRule.create({ data: body });
    res.status(201).json(rule);
  } catch (err) {
    next(err);
  }
});

// GET /api/alert-rules/:id
alertRulesRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const rule = await prisma.alertRule.findUnique({
      where: { id },
      include: { service: { select: { name: true, environment: true } } },
    });
    if (!rule) throw new AppError(404, 'NOT_FOUND', 'Alert rule not found');
    res.json(rule);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/alert-rules/:id
alertRulesRouter.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const body = patchRuleSchema.parse(req.body);
    const existing = await prisma.alertRule.findUnique({ where: { id } });
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Alert rule not found');

    const rule = await prisma.alertRule.update({
      where: { id },
      data: body,
    });
    res.json(rule);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/alert-rules/:id
alertRulesRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const existing = await prisma.alertRule.findUnique({ where: { id } });
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Alert rule not found');

    await prisma.alertRule.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
