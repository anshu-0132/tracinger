import { Router, Request, Response } from 'express';
import { prisma } from '../config/database';

export const healthRouter = Router();

healthRouter.get('/live', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

healthRouter.get('/ready', async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'ready',
      timestamp: new Date().toISOString(),
      checks: { database: 'ok' },
    });
  } catch (err) {
    res.status(503).json({
      status: 'not_ready',
      timestamp: new Date().toISOString(),
      checks: { database: 'error' },
    });
  }
});
