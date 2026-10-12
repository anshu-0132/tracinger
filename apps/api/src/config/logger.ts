import pino from 'pino';
import { env } from './env';

export const logger = pino({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  transport:
    env.NODE_ENV !== 'production'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
  redact: {
    paths: ['*.password', '*.token', '*.secret', '*.authorization', '*.cookie'],
    censor: '[REDACTED]',
  },
  base: {
    service: 'tracelens-api',
    env: env.NODE_ENV,
  },
});
