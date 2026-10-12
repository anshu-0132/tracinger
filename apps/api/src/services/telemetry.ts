/**
 * Telemetry Service
 *
 * Abstracts all queries to the observability backends:
 *   - Prometheus (metrics)
 *   - Loki (logs)
 *   - Tempo (traces)
 *
 * When a backend is unavailable, methods return empty results rather than
 * crashing the API, and always document the failure via the logger.
 */

import axios, { AxiosInstance } from 'axios';
import { logger } from '../config/logger';
import { env } from '../config/env';
import type { LogEntry, SpanInfo, TraceInfo, TimeSeriesPoint } from '@tracelens/shared';

const QUERY_TIMEOUT_MS = 10_000;

function makeHttp(baseURL: string): AxiosInstance {
  return axios.create({ baseURL, timeout: QUERY_TIMEOUT_MS });
}

// Prometheus range_query helper — converts "now-1h" style to Unix timestamps
function parseTimeRange(raw: string): number {
  const now = Math.floor(Date.now() / 1000);
  if (raw === 'now') return now;
  const m = raw.match(/^now-(\d+)([smhd])$/);
  if (!m) {
    // Try parsing as ISO date
    const ts = Date.parse(raw);
    return isNaN(ts) ? now : Math.floor(ts / 1000);
  }
  const [, num, unit] = m;
  const secs: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  return now - parseInt(num, 10) * (secs[unit] ?? 60);
}

function toTimeSeries(result: any[]): TimeSeriesPoint[] {
  return result.flatMap((r: any) =>
    (r.values ?? []).map(([ts, v]: [number, string]) => ({
      timestamp: new Date(ts * 1000).toISOString(),
      value: parseFloat(v),
    })),
  );
}

class TelemetryService {
  private prometheus: AxiosInstance;
  private loki: AxiosInstance;
  private tempo: AxiosInstance;

  constructor() {
    this.prometheus = makeHttp(env.PROMETHEUS_BASE_URL);
    this.loki = makeHttp(env.LOKI_BASE_URL);
    this.tempo = makeHttp(env.TEMPO_BASE_URL);
  }

  // ── Health checks ────────────────────────────────────────────────────────

  async checkPrometheus(): Promise<'ok' | 'error'> {
    try {
      await this.prometheus.get('/-/healthy');
      return 'ok';
    } catch {
      return 'error';
    }
  }

  async checkLoki(): Promise<'ok' | 'error'> {
    try {
      await this.loki.get('/ready');
      return 'ok';
    } catch {
      return 'error';
    }
  }

  async checkTempo(): Promise<'ok' | 'error'> {
    try {
      await this.tempo.get('/ready');
      return 'ok';
    } catch {
      return 'error';
    }
  }

  // ── Prometheus metric queries ────────────────────────────────────────────

  /**
   * Execute a Prometheus instant query and return numeric value (or null).
   */
  async instantQuery(promql: string): Promise<number | null> {
    try {
      const res = await this.prometheus.get('/api/v1/query', {
        params: { query: promql },
      });
      const results: any[] = res.data?.data?.result ?? [];
      if (results.length === 0) return null;
      const v = parseFloat(results[0].value?.[1]);
      return isNaN(v) ? null : v;
    } catch (err) {
      logger.warn({ err, promql }, 'Prometheus instant query failed');
      return null;
    }
  }

  /**
   * Execute a Prometheus range query and return time-series data.
   */
  async rangeQuery(
    promql: string,
    from: string,
    to: string,
    step: string,
  ): Promise<TimeSeriesPoint[]> {
    try {
      const start = parseTimeRange(from);
      const end = parseTimeRange(to);
      const res = await this.prometheus.get('/api/v1/query_range', {
        params: { query: promql, start, end, step },
      });
      const results: any[] = res.data?.data?.result ?? [];
      return toTimeSeries(results);
    } catch (err) {
      logger.warn({ err, promql }, 'Prometheus range query failed');
      return [];
    }
  }

  // ── Service health and metrics ───────────────────────────────────────────

  async getServiceHealthSummary(
    serviceName: string,
    _environment: string,
  ): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
    errorRate?: number;
    requestRate?: number;
    p95Latency?: number;
    lastSeenAt?: string;
    recentIncidentCount: number;
    activeIncidentCount: number;
  }> {
    // Query Prometheus for error rate and request rate
    // Uses OTEL-generated metrics: http_server_request_duration_seconds (OpenTelemetry semantic)
    const labelFilter = `service_name="${serviceName}"`;

    const [errorRate, requestRate, p95] = await Promise.all([
      this.instantQuery(
        `sum(rate(http_server_request_duration_seconds_count{${labelFilter},http_response_status_code=~"5.."}[5m])) / sum(rate(http_server_request_duration_seconds_count{${labelFilter}}[5m]))`,
      ),
      this.instantQuery(
        `sum(rate(http_server_request_duration_seconds_count{${labelFilter}}[5m]))`,
      ),
      this.instantQuery(
        `histogram_quantile(0.95, sum(rate(http_server_request_duration_seconds_bucket{${labelFilter}}[5m])) by (le)) * 1000`,
      ),
    ]);

    // Determine health status
    let status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown' = 'unknown';
    if (requestRate !== null) {
      if (errorRate !== null && errorRate > 0.5) status = 'unhealthy';
      else if (errorRate !== null && errorRate > 0.05) status = 'degraded';
      else status = 'healthy';
    }

    // Get incident counts from database
    const { prisma } = await import('../config/database');
    const [recentIncidentCount, activeIncidentCount] = await Promise.all([
      prisma.incident.count({
        where: {
          service: { name: serviceName },
          startedAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) },
        },
      }),
      prisma.incident.count({
        where: {
          service: { name: serviceName },
          status: { in: ['OPEN', 'ACKNOWLEDGED'] },
        },
      }),
    ]);

    return {
      status,
      errorRate: errorRate ?? undefined,
      requestRate: requestRate ?? undefined,
      p95Latency: p95 ?? undefined,
      lastSeenAt: requestRate !== null ? new Date().toISOString() : undefined,
      recentIncidentCount,
      activeIncidentCount,
    };
  }

  async getServiceMetrics(
    serviceName: string,
    _environment: string,
    from: string,
    to: string,
    step: string,
  ) {
    const label = `service_name="${serviceName}"`;

    const [requestRate, errorRate, p50, p95, p99] = await Promise.all([
      this.rangeQuery(
        `sum(rate(http_server_request_duration_seconds_count{${label}}[5m]))`,
        from,
        to,
        step,
      ),
      this.rangeQuery(
        `sum(rate(http_server_request_duration_seconds_count{${label},http_response_status_code=~"5.."}[5m])) / sum(rate(http_server_request_duration_seconds_count{${label}}[5m]))`,
        from,
        to,
        step,
      ),
      this.rangeQuery(
        `histogram_quantile(0.50, sum(rate(http_server_request_duration_seconds_bucket{${label}}[5m])) by (le)) * 1000`,
        from,
        to,
        step,
      ),
      this.rangeQuery(
        `histogram_quantile(0.95, sum(rate(http_server_request_duration_seconds_bucket{${label}}[5m])) by (le)) * 1000`,
        from,
        to,
        step,
      ),
      this.rangeQuery(
        `histogram_quantile(0.99, sum(rate(http_server_request_duration_seconds_bucket{${label}}[5m])) by (le)) * 1000`,
        from,
        to,
        step,
      ),
    ]);

    return {
      serviceName,
      timeRange: { from, to },
      requestRate,
      errorRate,
      p50Latency: p50,
      p95Latency: p95,
      p99Latency: p99,
    };
  }

  // ── Loki log queries ──────────────────────────────────────────────────────

  async queryLogs(params: {
    service?: string;
    level?: string;
    traceId?: string;
    from?: string;
    to?: string;
    search?: string;
    limit?: number;
  }): Promise<LogEntry[]> {
    try {
      const parts: string[] = [];
      if (params.service) parts.push(`service_name="${params.service}"`);
      if (params.level) parts.push(`level="${params.level}"`);
      if (params.traceId) parts.push(`trace_id="${params.traceId}"`);

      const streamSelector = `{${parts.length > 0 ? parts.join(',') : 'service_name=~".+"'}}`;
      let logql = streamSelector;

      if (params.search) {
        logql += ` |= \`${params.search.replace(/`/g, '')}\``;
      }

      const startNs = parseTimeRange(params.from ?? 'now-1h') * 1e9;
      const endNs = parseTimeRange(params.to ?? 'now') * 1e9;

      const res = await this.loki.get('/loki/api/v1/query_range', {
        params: {
          query: logql,
          start: startNs,
          end: endNs,
          limit: params.limit ?? 100,
          direction: 'backward',
        },
      });

      const streams: any[] = res.data?.data?.result ?? [];
      const entries: LogEntry[] = [];

      for (const stream of streams) {
        const labels: Record<string, string> = stream.stream ?? {};
        for (const [tsNs, line] of stream.values ?? []) {
          try {
            const parsed = JSON.parse(line);
            entries.push({
              timestamp: new Date(Number(BigInt(tsNs) / 1_000_000n)).toISOString(),
              level: parsed.level ?? parsed.severity ?? 'info',
              message: parsed.msg ?? parsed.message ?? line,
              service: labels.service_name ?? parsed.service,
              traceId: parsed.trace_id ?? parsed.traceId,
              spanId: parsed.span_id ?? parsed.spanId,
              labels,
              ...parsed,
            });
          } catch {
            entries.push({
              timestamp: new Date(Number(BigInt(tsNs) / 1_000_000n)).toISOString(),
              level: 'info',
              message: line,
              labels,
            });
          }
        }
      }

      return entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    } catch (err) {
      logger.warn({ err }, 'Loki log query failed');
      return [];
    }
  }

  // ── Tempo trace queries ───────────────────────────────────────────────────

  async getTrace(traceId: string): Promise<TraceInfo | null> {
    try {
      const res = await this.tempo.get(`/api/traces/${traceId}`, {
        headers: { Accept: 'application/json' },
      });

      const batches = res.data?.batches ?? [];
      const spans: SpanInfo[] = [];

      for (const batch of batches) {
        const serviceName =
          batch.resource?.attributes?.find((a: any) => a.key === 'service.name')?.value
            ?.stringValue ?? 'unknown';

        for (const scopeSpan of batch.scopeSpans ?? []) {
          for (const span of scopeSpan.spans ?? []) {
            const status = span.status?.code === 2 ? 'error' : 'ok';
            const startNs = BigInt(span.startTimeUnixNano ?? 0);
            const endNs = BigInt(span.endTimeUnixNano ?? 0);
            const durationMs = Number((endNs - startNs) / 1_000_000n);

            const attributes: Record<string, string | number | boolean> = {};
            for (const attr of span.attributes ?? []) {
              const val = attr.value;
              attributes[attr.key] =
                val?.stringValue ?? val?.intValue ?? val?.boolValue ?? val?.doubleValue ?? '';
            }

            spans.push({
              traceId,
              spanId: span.spanId ?? '',
              parentSpanId: span.parentSpanId ?? undefined,
              operationName: span.name ?? '',
              serviceName,
              startTime: new Date(Number(startNs / 1_000_000n)).toISOString(),
              duration: durationMs,
              status,
              statusMessage: span.status?.message,
              attributes,
            });
          }
        }
      }

      if (spans.length === 0) return null;

      const rootSpan = spans.find((s) => !s.parentSpanId) ?? spans[0];
      const hasErrors = spans.some((s) => s.status === 'error');
      const services = [...new Set(spans.map((s) => s.serviceName))];
      const totalDuration = Math.max(...spans.map((s) => s.duration));

      return { traceId, rootSpan, spans, totalDuration, hasErrors, services };
    } catch (err) {
      logger.warn({ err, traceId }, 'Tempo trace query failed');
      return null;
    }
  }

  async searchTraces(
    serviceName: string,
    from: string,
    to: string,
  ): Promise<{ traceId: string; rootOperationName: string; duration: number; startTime: string; hasErrors: boolean }[]> {
    try {
      const start = parseTimeRange(from);
      const end = parseTimeRange(to);

      const res = await this.tempo.get('/api/search', {
        params: {
          service: serviceName,
          start,
          end,
          limit: 50,
        },
      });

      return (res.data?.traces ?? []).map((t: any) => ({
        traceId: t.traceID,
        rootOperationName: t.rootSpanName ?? t.rootTraceName,
        duration: Math.round((t.durationMs ?? 0)),
        startTime: new Date((t.startTimeUnixNano ?? 0) / 1_000_000).toISOString(),
        hasErrors: t.spanSet?.spans?.some((s: any) => s.attributes?.find((a: any) => a.key === 'status.code' && a.value?.intValue === 2)) ?? false,
      }));
    } catch (err) {
      logger.warn({ err, serviceName }, 'Tempo trace search failed');
      return [];
    }
  }

  // ── Metric evaluation for alert rules ────────────────────────────────────

  /**
   * Evaluate a specific AlertMetric for a service over a given window.
   * Returns null when metric is absent (distinct from a zero reading).
   */
  async evaluateMetric(
    metric: string,
    serviceName: string,
    windowMinutes: number,
  ): Promise<number | null> {
    const label = `service_name="${serviceName}"`;
    const window = `${windowMinutes}m`;

    const queries: Record<string, string> = {
      ERROR_RATE: `sum(rate(http_server_request_duration_seconds_count{${label},http_response_status_code=~"5.."}[${window}])) / sum(rate(http_server_request_duration_seconds_count{${label}}[${window}]))`,
      P95_LATENCY: `histogram_quantile(0.95, sum(rate(http_server_request_duration_seconds_bucket{${label}}[${window}])) by (le)) * 1000`,
      P99_LATENCY: `histogram_quantile(0.99, sum(rate(http_server_request_duration_seconds_bucket{${label}}[${window}])) by (le)) * 1000`,
      P50_LATENCY: `histogram_quantile(0.50, sum(rate(http_server_request_duration_seconds_bucket{${label}}[${window}])) by (le)) * 1000`,
      REQUEST_RATE: `sum(rate(http_server_request_duration_seconds_count{${label}}[${window}]))`,
      AVAILABILITY: `1 - (sum(rate(http_server_request_duration_seconds_count{${label},http_response_status_code=~"5.."}[${window}])) / sum(rate(http_server_request_duration_seconds_count{${label}}[${window}])))`,
    };

    const promql = queries[metric];
    if (!promql) return null;
    return this.instantQuery(promql);
  }
}

export const telemetryService = new TelemetryService();
