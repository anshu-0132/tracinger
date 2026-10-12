/**
 * TraceLens Worker
 *
 * Runs scheduled jobs:
 *   1. Alert rule evaluation (default: every 30 s)
 *   2. Notification delivery with exponential backoff retry
 *
 * Design principles:
 *   - Never crashes permanently on a transient failure
 *   - Logs structured errors for every failure
 *   - Resumes correctly after restart (state is in PostgreSQL)
 *   - Separate concerns: evaluation ≠ notification
 */

import cron from 'node-cron';
import pino from 'pino';
import { PrismaClient } from '@prisma/client';
import { evaluateRule } from './jobs/evaluateRules';
import { processNotifications } from './jobs/processNotifications';

// ── Config from environment ──────────────────────────────────────────────────
const DATABASE_URL = process.env.DATABASE_URL;
const EVAL_INTERVAL_SECONDS = parseInt(process.env.ALERT_EVAL_INTERVAL_SECONDS ?? '30', 10);
const NODE_ENV = process.env.NODE_ENV ?? 'development';

if (!DATABASE_URL) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

// ── Logger ───────────────────────────────────────────────────────────────────
const logger = pino({
  level: NODE_ENV === 'production' ? 'info' : 'debug',
  transport:
    NODE_ENV !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } }
      : undefined,
  base: { service: 'tracelens-worker', env: NODE_ENV },
});

// ── Database ─────────────────────────────────────────────────────────────────
const prisma = new PrismaClient();

// ── Alert evaluation cron ────────────────────────────────────────────────────
// Convert seconds to a safe cron expression (min 10s to avoid overwhelming Prometheus)
const evalIntervalSafe = Math.max(EVAL_INTERVAL_SECONDS, 10);
// cron.schedule uses standard 5-field expressions; for sub-minute we use setInterval
let evalRunning = false;

async function runEvaluation(): Promise<void> {
  if (evalRunning) {
    logger.debug('Skipping evaluation — previous run still in progress');
    return;
  }
  evalRunning = true;
  try {
    await evaluateRule(prisma, logger);
  } catch (err) {
    logger.error({ err }, 'Alert evaluation cycle failed');
  } finally {
    evalRunning = false;
  }
}

// ── Notification processing cron ─────────────────────────────────────────────
let notifRunning = false;

async function runNotifications(): Promise<void> {
  if (notifRunning) return;
  notifRunning = true;
  try {
    await processNotifications(prisma, logger);
  } catch (err) {
    logger.error({ err }, 'Notification processing failed');
  } finally {
    notifRunning = false;
  }
}

// ── Startup ──────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  try {
    await prisma.$connect();
    logger.info({ evalIntervalSeconds: evalIntervalSafe }, 'Worker connected to database');
  } catch (err) {
    logger.fatal({ err }, 'Worker failed to connect to database');
    process.exit(1);
  }

  // Run evaluation on interval
  setInterval(runEvaluation, evalIntervalSafe * 1000);
  // Run notifications every 15 s
  setInterval(runNotifications, 15_000);

  // Run immediately on startup
  await runEvaluation();
  await runNotifications();

  logger.info('Worker running');
}

// ── Graceful shutdown ────────────────────────────────────────────────────────
const shutdown = async (signal: string) => {
  logger.info({ signal }, 'Worker shutdown signal received');
  await prisma.$disconnect();
  logger.info('Worker disconnected from database');
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Worker uncaught exception');
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  logger.fatal({ reason }, 'Worker unhandled rejection');
  process.exit(1);
});

main();
