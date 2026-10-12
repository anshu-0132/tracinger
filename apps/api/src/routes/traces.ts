import { Router, Request, Response, NextFunction } from 'express';
import { telemetryService } from '../services/telemetry';
import { AppError } from '../middleware/errorHandler';

export const tracesRouter = Router();

// GET /api/traces/:traceId
tracesRouter.get('/:traceId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const traceId = req.params.traceId as string;
    if (!traceId || traceId.length < 16) {
      throw new AppError(400, 'INVALID_TRACE_ID', 'Invalid trace ID format');
    }
    const trace = await telemetryService.getTrace(traceId);
    if (!trace) {
      throw new AppError(404, 'NOT_FOUND', 'Trace not found');
    }
    res.json(trace);
  } catch (err) {
    next(err);
  }
});
