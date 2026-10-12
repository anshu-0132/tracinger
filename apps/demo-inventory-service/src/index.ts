import './telemetry';

import express from 'express';
import pino from 'pino';
import { trace, SpanStatusCode } from '@opentelemetry/api';

const logger = pino({
  level: 'info',
  transport:
    process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
  base: { service: 'inventory-service' },
});

const PORT = parseInt(process.env.PORT ?? '3011', 10);

// ── Fault injection state ────────────────────────────────────────────────────
let faultMode: null | { type: string; until: Date } = null;

const app = express();
app.use(express.json());

// Inventory in-memory store (demo data)
const inventory: Record<string, number> = {
  'Widget A': 150,
  'Widget B': 30,
  'Widget C': 0,
  'Widget D': 500,
};

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'inventory-service' });
});

app.get('/inventory', async (_req, res) => {
  const tracer = trace.getTracer('inventory-service');

  await tracer.startActiveSpan('list-inventory', async (span) => {
    try {
      if (faultMode && new Date() < faultMode.until) {
        if (faultMode.type === 'service_failure' || faultMode.type === 'http_5xx') {
          span.setStatus({ code: SpanStatusCode.ERROR });
          span.end();
          return res.status(500).json({ error: 'Inventory service unavailable (injected fault)' });
        }
        if (faultMode.type === 'dependency_timeout') {
          await sleep(30_000); // simulate timeout (caller should time out first)
        }
      } else {
        faultMode = null;
      }

      span.end();
      res.json({ inventory, lastUpdated: new Date().toISOString() });
    } catch (err: any) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      span.end();
      res.status(500).json({ error: 'Inventory lookup failed' });
    }
  });
});

app.get('/inventory/:product', async (req, res) => {
  const tracer = trace.getTracer('inventory-service');

  await tracer.startActiveSpan('get-product-inventory', async (span) => {
    span.setAttribute('product', req.params.product);

    try {
      if (faultMode && new Date() < faultMode.until) {
        if (['service_failure', 'http_5xx', 'dependency_timeout'].includes(faultMode.type)) {
          span.setStatus({ code: SpanStatusCode.ERROR });
          span.end();
          return res.status(503).json({ error: 'Inventory temporarily unavailable' });
        }
      } else {
        faultMode = null;
      }

      const stock = inventory[req.params.product];
      if (stock === undefined) {
        span.end();
        return res.status(404).json({ error: 'Product not found' });
      }

      logger.info({ product: req.params.product, stock }, 'Inventory checked');
      span.setAttribute('stock', stock);
      span.end();
      res.json({ product: req.params.product, stock });
    } catch (err: any) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      span.end();
      res.status(500).json({ error: 'Inventory lookup failed' });
    }
  });
});

// ── POST /fault ──────────────────────────────────────────────────────────────
app.post('/fault', (req, res) => {
  if (process.env.ENABLE_FAULT_INJECTION !== 'true') {
    return res.status(403).json({ error: 'Fault injection disabled' });
  }
  const { type, durationSeconds } = req.body;
  const until = new Date(Date.now() + (durationSeconds ?? 60) * 1000);
  faultMode = { type, until };
  logger.warn({ type, durationSeconds }, 'Fault activated on inventory-service');
  res.json({ ok: true, type, until });
});

app.delete('/fault', (_req, res) => {
  faultMode = null;
  res.json({ ok: true });
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

app.listen(PORT, () => {
  logger.info({ port: PORT }, 'Inventory service started');
});
