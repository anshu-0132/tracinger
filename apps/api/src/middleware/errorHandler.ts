import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../config/logger';

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function notFound(req: Request, res: Response): void {
  res.status(404).json({
    error: `Route ${req.method} ${req.path} not found`,
    code: 'NOT_FOUND',
    requestId: req.requestId,
  });
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  const requestId = req.requestId;

  if (err instanceof AppError) {
    logger.warn({ err, requestId }, err.message);
    res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      details: err.details,
      requestId,
    });
    return;
  }

  if (err instanceof ZodError) {
    logger.warn({ err, requestId }, 'Validation error');
    res.status(400).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: err.flatten(),
      requestId,
    });
    return;
  }

  // Prisma known errors
  if ((err as any).code === 'P2002') {
    res.status(409).json({
      error: 'A record with these values already exists',
      code: 'CONFLICT',
      requestId,
    });
    return;
  }

  if ((err as any).code === 'P2025') {
    res.status(404).json({
      error: 'Record not found',
      code: 'NOT_FOUND',
      requestId,
    });
    return;
  }

  // Unknown errors — never leak stack traces to the client
  logger.error({ err, requestId }, 'Unhandled error');
  res.status(500).json({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
    requestId,
  });
}
