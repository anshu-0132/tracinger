/**
 * Notification delivery job.
 * Processes pending and retry-eligible notification deliveries.
 * Uses exponential backoff: delay = min(2^attempts × 5s, 3600s)
 */

import type { PrismaClient } from '@prisma/client';
import type { Logger } from 'pino';
import axios from 'axios';

const MAX_DELIVERY_ATTEMPTS = 5;
const REQUEST_TIMEOUT_MS = 10_000;

function nextAttemptDelay(attempts: number): number {
  // Exponential backoff: 5s, 10s, 20s, 40s, 80s
  return Math.min(Math.pow(2, attempts) * 5_000, 3_600_000);
}

export async function processNotifications(prisma: PrismaClient, logger: Logger): Promise<void> {
  const now = new Date();

  const pending = await prisma.notificationDelivery.findMany({
    where: {
      status: { in: ['PENDING', 'RETRY'] },
      attempts: { lt: MAX_DELIVERY_ATTEMPTS },
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
    },
    include: {
      notificationConfig: true,
      incident: {
        include: { service: { select: { name: true, environment: true } } },
      },
    },
    take: 20,
  });

  for (const delivery of pending) {
    const { notificationConfig: config, incident } = delivery;

    if (!config.enabled || !config.webhookUrl) {
      await prisma.notificationDelivery.update({
        where: { id: delivery.id },
        data: { status: 'FAILED', error: 'Notification channel disabled or missing webhook URL' },
      });
      continue;
    }

    const payload = {
      event: delivery.event,
      incident: {
        id: incident.id,
        title: incident.title,
        severity: incident.severity,
        status: incident.status,
        service: incident.service.name,
        environment: incident.service.environment,
        startedAt: incident.startedAt,
        currentValue: incident.currentValue,
        threshold: incident.threshold,
      },
      timestamp: now.toISOString(),
    };

    try {
      const response = await axios.post(config.webhookUrl, payload, {
        timeout: REQUEST_TIMEOUT_MS,
        headers: { 'Content-Type': 'application/json', 'X-TraceLens-Event': delivery.event },
        validateStatus: (status) => status < 500,
      });

      const success = response.status < 300;

      await prisma.notificationDelivery.update({
        where: { id: delivery.id },
        data: {
          status: success ? 'DELIVERED' : 'RETRY',
          attempts: delivery.attempts + 1,
          lastAttemptAt: now,
          nextAttemptAt: success
            ? null
            : new Date(now.getTime() + nextAttemptDelay(delivery.attempts + 1)),
          responseCode: response.status,
          responseBody: String(response.data).slice(0, 500),
          error: success ? null : `HTTP ${response.status}`,
        },
      });

      if (success) {
        logger.info({ deliveryId: delivery.id, event: delivery.event }, 'Notification delivered');
      } else {
        logger.warn(
          { deliveryId: delivery.id, status: response.status },
          'Notification delivery failed — will retry',
        );
      }
    } catch (err: any) {
      const nextAttempts = delivery.attempts + 1;
      const exhausted = nextAttempts >= MAX_DELIVERY_ATTEMPTS;

      await prisma.notificationDelivery.update({
        where: { id: delivery.id },
        data: {
          status: exhausted ? 'FAILED' : 'RETRY',
          attempts: nextAttempts,
          lastAttemptAt: now,
          nextAttemptAt: exhausted
            ? null
            : new Date(now.getTime() + nextAttemptDelay(nextAttempts)),
          error: err.message?.slice(0, 500),
        },
      });

      logger.error(
        { err, deliveryId: delivery.id, attempts: nextAttempts, exhausted },
        'Notification delivery error',
      );
    }
  }
}
