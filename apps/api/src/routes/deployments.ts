import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';

export const deploymentsRouter = Router();

const createDeploymentSchema = z.object({
  serviceName: z.string().min(1).max(200),
  environment: z.string().min(1).max(100).default('production'),
  version: z.string().min(1).max(200),
  commitSha: z.string().max(64).optional(),
  releaseNotes: z.string().max(5000).optional(),
  deployedAt: z.string().datetime().optional(),
  deployedBy: z.string().max(200).optional(),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  serviceName: z.string().optional(),
  environment: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

// GET /api/deployments
deploymentsRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, pageSize, serviceName, environment, from, to } = listQuerySchema.parse(req.query);
    const where: Record<string, unknown> = {};
    if (serviceName) where.serviceName = serviceName;
    if (environment) where.environment = environment;
    if (from || to) {
      where.deployedAt = {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lte: new Date(to) } : {}),
      };
    }

    const [deployments, total] = await Promise.all([
      prisma.deployment.findMany({
        where,
        orderBy: { deployedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.deployment.count({ where }),
    ]);

    res.json({ data: deployments, total, page, pageSize, hasMore: page * pageSize < total });
  } catch (err) {
    next(err);
  }
});

// POST /api/deployments
deploymentsRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = createDeploymentSchema.parse(req.body);
    const deployment = await prisma.deployment.create({
      data: {
        ...body,
        deployedAt: body.deployedAt ? new Date(body.deployedAt) : new Date(),
      },
    });
    res.status(201).json(deployment);
  } catch (err) {
    next(err);
  }
});
