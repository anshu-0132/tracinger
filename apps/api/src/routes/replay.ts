import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { replayService } from '../services/replay';
import { env } from '../config/env';

export const replayRouter = Router();

const runScenarioSchema = z.object({
  scenarioId: z.string().min(1),
});

const listRunsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  scenarioId: z.string().optional(),
  status: z
    .enum(['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED'])
    .optional(),
});

// GET /api/replay/scenarios
replayRouter.get('/scenarios', (_req: Request, res: Response) => {
  res.json({ data: replayService.getScenarios() });
});

// POST /api/replay/runs
replayRouter.post('/runs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!env.ENABLE_FAULT_INJECTION) {
      throw new AppError(
        403,
        'FAULT_INJECTION_DISABLED',
        'Fault injection is disabled. Set ENABLE_FAULT_INJECTION=true in development.',
      );
    }

    const { scenarioId } = runScenarioSchema.parse(req.body);
    const scenario = replayService.getScenario(scenarioId);
    if (!scenario) {
      throw new AppError(404, 'NOT_FOUND', `Scenario '${scenarioId}' not found`);
    }

    const run = await replayService.startRun(scenarioId);
    res.status(202).json(run);
  } catch (err) {
    next(err);
  }
});

// GET /api/replay/runs
replayRouter.get('/runs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, pageSize, scenarioId, status } = listRunsSchema.parse(req.query);
    const where: Record<string, unknown> = {};
    if (scenarioId) where.scenarioId = scenarioId;
    if (status) where.status = status;

    const [runs, total] = await Promise.all([
      prisma.replayRun.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.replayRun.count({ where }),
    ]);

    res.json({ data: runs, total, page, pageSize, hasMore: page * pageSize < total });
  } catch (err) {
    next(err);
  }
});

// GET /api/replay/runs/:id
replayRouter.get('/runs/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const run = await prisma.replayRun.findUnique({ where: { id } });
    if (!run) throw new AppError(404, 'NOT_FOUND', 'Replay run not found');
    res.json(run);
  } catch (err) {
    next(err);
  }
});
