import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().default('postgresql://tracelens:tracelens_dev_pw@localhost:5432/tracelens'),
  CORS_ORIGINS: z.string().default('http://localhost:5173,http://localhost:3000'),
  // Telemetry backend
  GRAFANA_BASE_URL: z.string().url().default('http://localhost:3000'),
  LOKI_BASE_URL: z.string().url().default('http://localhost:3100'),
  TEMPO_BASE_URL: z.string().url().default('http://localhost:3200'),
  PROMETHEUS_BASE_URL: z.string().url().default('http://localhost:9090'),
  // OpenTelemetry
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().default('http://localhost:4318'),
  OTEL_SERVICE_NAME: z.string().default('tracelens-api'),
  // Demo services
  ORDER_SERVICE_URL: z.string().url().default('http://localhost:3010'),
  INVENTORY_SERVICE_URL: z.string().url().default('http://localhost:3011'),
  // Feature flags
  ENABLE_FAULT_INJECTION: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .default('false'),
  // Worker
  ALERT_EVAL_INTERVAL_SECONDS: z.coerce.number().int().positive().default(30),
  // Rate limiting
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
});

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('❌  Environment validation failed:');
    console.error(parsed.error.format());
    process.exit(1);
  }
  return parsed.data;
}

export const env = loadEnv();
export type Env = z.infer<typeof envSchema>;
