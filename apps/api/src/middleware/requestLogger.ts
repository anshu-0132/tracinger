import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';
import { v4 as uuidv4 } from 'uuid';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      startTime: number;
    }
  }
}

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  req.requestId = uuidv4();
  req.startTime = Date.now();

  res.setHeader('X-Request-ID', req.requestId);

  res.on('finish', () => {
    const duration = Date.now() - req.startTime;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';

    logger[level](
      {
        requestId: req.requestId,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        durationMs: duration,
        userAgent: req.headers['user-agent'],
        ip: req.ip,
      },
      `${req.method} ${req.path} ${res.statusCode} (${duration}ms)`,
    );
  });

  next();
}
