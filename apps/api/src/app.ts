import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import { logger } from './config/logger';
import { healthRouter } from './routes/health';
import { overviewRouter } from './routes/overview';
import { servicesRouter } from './routes/services';
import { alertRulesRouter } from './routes/alertRules';
import { incidentsRouter } from './routes/incidents';
import { deploymentsRouter } from './routes/deployments';
import { logsRouter } from './routes/logs';
import { tracesRouter } from './routes/traces';
import { replayRouter } from './routes/replay';
import { settingsRouter } from './routes/settings';
import { notFound, errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';

export function createApp(): Application {
  const app = express();

  // ── Security headers ──────────────────────────────────────────────────────
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // ── CORS ──────────────────────────────────────────────────────────────────
  const allowedOrigins = env.CORS_ORIGINS.split(',').map((o) => o.trim());
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error(`CORS: origin ${origin} not allowed`));
        }
      },
      credentials: true,
    }),
  );

  // ── Body parsing ──────────────────────────────────────────────────────────
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false }));

  // ── Rate limiting ──────────────────────────────────────────────────────────
  app.use(
    '/api/',
    rateLimit({
      windowMs: env.RATE_LIMIT_WINDOW_MS,
      max: env.RATE_LIMIT_MAX,
      standardHeaders: true,
      legacyHeaders: false,
      handler: (_req, res) => {
        res.status(429).json({ error: 'Too many requests', code: 'RATE_LIMITED' });
      },
    }),
  );

  // ── Request logging ───────────────────────────────────────────────────────
  app.use(requestLogger);

  // ── Routes ────────────────────────────────────────────────────────────────
  app.use('/api/health', healthRouter);
  app.use('/api/overview', overviewRouter);
  app.use('/api/services', servicesRouter);
  app.use('/api/alert-rules', alertRulesRouter);
  app.use('/api/incidents', incidentsRouter);
  app.use('/api/deployments', deploymentsRouter);
  app.use('/api/logs', logsRouter);
  app.use('/api/traces', tracesRouter);
  app.use('/api/replay', replayRouter);
  app.use('/api/settings', settingsRouter);

  // ── 404 and error handling ────────────────────────────────────────────────
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
