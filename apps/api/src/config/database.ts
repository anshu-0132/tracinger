import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log: [
      { emit: 'event', level: 'error' },
      { emit: 'event', level: 'warn' },
    ],
  });
}

// Reuse client in development to avoid too many connections during hot-reloads
export const prisma = global.__prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}

// Log Prisma events at the correct Pino level
(prisma as any).$on('error', (e: { message: string; target: string }) => {
  logger.error({ msg: e.message, target: e.target }, 'Prisma error');
});
(prisma as any).$on('warn', (e: { message: string; target: string }) => {
  logger.warn({ msg: e.message, target: e.target }, 'Prisma warning');
});
