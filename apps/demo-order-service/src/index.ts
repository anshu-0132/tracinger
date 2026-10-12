// OTel must be initialized first
import './telemetry';

import express from 'express';
import axios from 'axios';
import pino from 'pino';
import { trace, context, SpanStatusCode } from '@opentelemetry/api';

const logger = pino({
  level: 'info',
  transport:
    process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
  base: { service: 'order-service' },
});

const PORT = parseInt(process.env.PORT ?? '3010', 10);
const INVENTORY_URL = process.env.INVENTORY_SERVICE_URL ?? 'http://localhost:3011';

// ── Fault injection state ────────────────────────────────────────────────────
let faultMode: null | { type: string; until: Date } = null;

const app = express();
app.use(express.json());

// ── GET /health ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'order-service' });
});

// ── GET /orders — list orders ────────────────────────────────────────────────
app.get('/orders', async (req, res) => {
  const tracer = trace.getTracer('order-service');

  await tracer.startActiveSpan('list-orders', async (span) => {
    try {
      // Inject fault if active
      if (faultMode && new Date() < faultMode.until) {
        if (faultMode.type === 'http_5xx' || faultMode.type === 'service_failure' || faultMode.type === 'recovery') {
          span.setStatus({ code: SpanStatusCode.ERROR, message: 'Injected fault' });
          span.end();
          return res.status(500).json({ error: 'Internal server error (injected fault)' });
        }
        if (faultMode.type === 'latency_spike') {
          await sleep(3000); // 3 second artificial delay
        }
      } else {
        faultMode = null; // clear expired fault
      }

      // Call inventory service to check stock
      let inventory: any = { status: 'unknown' };
      try {
        const invRes = await axios.get(`${INVENTORY_URL}/inventory`, {
          timeout: faultMode?.type === 'dependency_timeout' ? 100 : 5000,
          headers: { traceparent: req.headers['traceparent'] ?? '' },
        });
        inventory = invRes.data;
      } catch (err: any) {
        logger.warn({ err: err.message }, 'Inventory service call failed');
        span.addEvent('inventory-call-failed', { error: err.message });
      }

      const orders = [
        { id: 'ord-001', product: 'Widget A', quantity: 2, status: 'shipped' },
        { id: 'ord-002', product: 'Widget B', quantity: 1, status: 'processing' },
        { id: 'ord-003', product: 'Widget C', quantity: 5, status: 'pending' },
      ];

      logger.info({ orderCount: orders.length, traceId: span.spanContext().traceId }, 'Orders listed');
      span.end();
      res.json({ orders, inventory });
    } catch (err: any) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      span.end();
      logger.error({ err: err.message }, 'Error listing orders');
      res.status(500).json({ error: 'Failed to list orders' });
    }
  });
});

// ── POST /orders — create order ──────────────────────────────────────────────
app.post('/orders', async (req, res) => {
  const tracer = trace.getTracer('order-service');

  await tracer.startActiveSpan('create-order', async (span) => {
    try {
      if (faultMode && new Date() < faultMode.until) {
        if (faultMode.type === 'http_5xx' || faultMode.type === 'recovery') {
          span.setStatus({ code: SpanStatusCode.ERROR });
          span.end();
          return res.status(500).json({ error: 'Order creation failed (injected fault)' });
        }
        if (faultMode.type === 'latency_spike') await sleep(3000);
      } else {
        faultMode = null;
      }

      const { product, quantity } = req.body;
      if (!product || !quantity) {
        span.end();
        return res.status(400).json({ error: 'product and quantity are required' });
      }

      // Check inventory via downstream call
      await axios.get(`${INVENTORY_URL}/inventory/${product}`, { timeout: 5000 });

      const order = { id: `ord-${Date.now()}`, product, quantity, status: 'created' };
      logger.info({ orderId: order.id }, 'Order created');
      span.end();
      res.status(201).json(order);
    } catch (err: any) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      span.end();
      res.status(500).json({ error: 'Order creation failed' });
    }
  });
});

// ── GET /slow — deliberate slow endpoint ─────────────────────────────────────
app.get('/slow', async (_req, res) => {
  const delay = parseInt(process.env.SLOW_DELAY_MS ?? '2000', 10);
  await sleep(delay);
  res.json({ message: 'Slow response', delayMs: delay });
});

// ── GET /error — deliberate error endpoint ───────────────────────────────────
app.get('/error', (_req, res) => {
  logger.error('Deliberate error endpoint triggered');
  res.status(500).json({ error: 'Deliberate error for testing' });
});

// ── POST /fault — fault injection (protected) ─────────────────────────────────
app.post('/fault', (req, res) => {
  if (process.env.ENABLE_FAULT_INJECTION !== 'true') {
    return res.status(403).json({ error: 'Fault injection is disabled' });
  }
  const { type, durationSeconds } = req.body;
  const validTypes = ['http_5xx', 'latency_spike', 'dependency_timeout', 'service_failure', 'recovery'];
  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: `Unknown fault type. Valid: ${validTypes.join(', ')}` });
  }
  const until = new Date(Date.now() + (durationSeconds ?? 60) * 1000);
  faultMode = { type, until };
  logger.warn({ type, durationSeconds, until }, 'Fault injection activated');
  res.json({ ok: true, type, until });
});

// ── DELETE /fault — clear fault ──────────────────────────────────────────────
app.delete('/fault', (_req, res) => {
  faultMode = null;
  res.json({ ok: true, message: 'Fault cleared' });
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

app.listen(PORT, () => {
  logger.info({ port: PORT }, 'Order service started');
});
