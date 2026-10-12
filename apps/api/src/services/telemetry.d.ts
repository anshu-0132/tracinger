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
import type { LogEntry, TraceInfo, TimeSeriesPoint } from '@tracinger/shared';
declare class TelemetryService {
    private prometheus;
    private loki;
    private tempo;
    constructor();
    checkPrometheus(): Promise<'ok' | 'error'>;
    checkLoki(): Promise<'ok' | 'error'>;
    checkTempo(): Promise<'ok' | 'error'>;
    /**
     * Execute a Prometheus instant query and return numeric value (or null).
     */
    instantQuery(promql: string): Promise<number | null>;
    /**
     * Execute a Prometheus range query and return time-series data.
     */
    rangeQuery(promql: string, from: string, to: string, step: string): Promise<TimeSeriesPoint[]>;
    getServiceHealthSummary(serviceName: string, _environment: string): Promise<{
        status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
        errorRate?: number;
        requestRate?: number;
        p95Latency?: number;
        lastSeenAt?: string;
        recentIncidentCount: number;
        activeIncidentCount: number;
    }>;
    getServiceMetrics(serviceName: string, _environment: string, from: string, to: string, step: string): Promise<{
        serviceName: string;
        timeRange: {
            from: string;
            to: string;
        };
        requestRate: TimeSeriesPoint[];
        errorRate: TimeSeriesPoint[];
        p50Latency: TimeSeriesPoint[];
        p95Latency: TimeSeriesPoint[];
        p99Latency: TimeSeriesPoint[];
    }>;
    queryLogs(params: {
        service?: string;
        level?: string;
        traceId?: string;
        from?: string;
        to?: string;
        search?: string;
        limit?: number;
    }): Promise<LogEntry[]>;
    getTrace(traceId: string): Promise<TraceInfo | null>;
    searchTraces(serviceName: string, from: string, to: string): Promise<{
        traceId: string;
        rootOperationName: string;
        duration: number;
        startTime: string;
        hasErrors: boolean;
    }[]>;
    /**
     * Evaluate a specific AlertMetric for a service over a given window.
     * Returns null when metric is absent (distinct from a zero reading).
     */
    evaluateMetric(metric: string, serviceName: string, windowMinutes: number): Promise<number | null>;
}
export declare const telemetryService: TelemetryService;
export {};
//# sourceMappingURL=telemetry.d.ts.map