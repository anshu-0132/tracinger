import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { telemetryService } from '../services/telemetry';

export const logsRouter = Router();

const logsQuerySchema = z.object({
  service: z.string().optional(),
  level: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).optional(),
  traceId: z.string().optional(),
  from: z.string().optional().default('now-1h'),
  to: z.string().optional().default('now'),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(100),
});

// GET /api/logs
logsRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = logsQuerySchema.parse(req.query);
    const logs = await telemetryService.queryLogs(params);
    res.json({ data: logs, total: logs.length });
  } catch (err) {
    next(err);
  }
});
