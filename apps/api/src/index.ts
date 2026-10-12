// ─────────────────────────────────────────────────────────────────────────────
// Telemetry must be initialized BEFORE any other imports to ensure
// auto-instrumentation patches libraries in time.
// ─────────────────────────────────────────────────────────────────────────────
import './telemetry';

import { createApp } from './app';
import { logger } from './config/logger';
import { env } from './config/env';
import { prisma } from './config/database';

const PORT = env.PORT;

async function main() {
  // Verify database connectivity before accepting requests
  try {
    await prisma.$connect();
    logger.info('Connected to PostgreSQL');
  } catch (err) {
    logger.fatal({ err }, 'Failed to connect to PostgreSQL — shutting down');
    process.exit(1);
  }

  const app = createApp();

  const server = app.listen(PORT, () => {
    logger.info({ port: PORT, env: env.NODE_ENV }, 'Tracinger API started');
  });

  // ── Graceful shutdown ────────────────────────────────────────────────────
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutdown signal received');
    server.close(async () => {
      await prisma.$disconnect();
      logger.info('Graceful shutdown complete');
      process.exit(0);
    });

    // Force exit after 10 s if graceful shutdown stalls
    setTimeout(() => {
      logger.warn('Forcing shutdown after timeout');
      process.exit(1);
    }, 10_000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'Uncaught exception');
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    logger.fatal({ reason }, 'Unhandled promise rejection');
    process.exit(1);
  });
}

main();
