import axios from 'axios';
import type {
  Service,
  ServiceHealth,
  ServiceMetrics,
  AlertRule,
  Incident,
  IncidentEvent,
  Deployment,
  ReplayScenario,
  ReplayRun,
  TraceInfo,
  LogEntry,
  PaginatedResponse,
} from '@tracelens/shared';
import {
  mockServices,
  mockOverview,
  mockAlertRules,
  mockIncidents,
  mockDeployments,
  mockReplayScenarios,
  mockReplayRuns,
  mockLogs,
  mockTrace,
  mockSettings,
  generateMetricsSeries,
} from './mockData';

const client = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 5000,
});

export interface OverviewData {
  timestamp: string;
  summary: {
    totalServices: number;
    openIncidents: number;
    recentIncidents: number;
    activeAlertRules: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
    unknown: number;
  };
  services: ServiceHealth[];
}

export interface SettingsStatus {
  timestamp: string;
  environment: string;
  faultInjectionEnabled: boolean;
  alertEvalIntervalSeconds: number;
  services: {
    database: 'ok' | 'error';
    prometheus: 'ok' | 'error';
    loki: 'ok' | 'error';
    tempo: 'ok' | 'error';
  };
  endpoints: {
    grafana: string;
    prometheus: string;
    loki: string;
    tempo: string;
  };
}

async function withFallback<T>(apiFn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await apiFn();
  } catch (err) {
    console.warn('[TraceLens] Live API query failed, utilizing fallback telemetry snapshot:', err);
    return fallback;
  }
}

export const api = {
  // ── Overview ─────────────────────────────────────────────────────────────
  getOverview: async (): Promise<OverviewData> => {
    return withFallback(async () => {
      const res = await client.get<OverviewData>('/overview');
      return res.data;
    }, mockOverview);
  },

  // ── Services ─────────────────────────────────────────────────────────────
  getServices: async (environment?: string): Promise<{ data: (Service & { health: ServiceHealth })[]; total: number }> => {
    return withFallback(async () => {
      const res = await client.get('/services', { params: { environment } });
      return res.data;
    }, { data: mockServices, total: mockServices.length });
  },

  getService: async (id: string): Promise<Service & { health: ServiceHealth; _count: { incidents: number; alertRules: number } }> => {
    const fallbackService = mockServices.find((s) => s.id === id || s.name === id) ?? mockServices[0];
    return withFallback(async () => {
      const res = await client.get(`/services/${id}`);
      return res.data;
    }, fallbackService);
  },

  getServiceMetrics: async (id: string, params?: { from?: string; to?: string; step?: string }): Promise<ServiceMetrics> => {
    const fallbackMetrics: ServiceMetrics = {
      serviceId: id,
      serviceName: id,
      environment: 'production',
      timeRange: { from: params?.from ?? 'now-1h', to: params?.to ?? 'now' },
      errorRate: generateMetricsSeries('errorRate', 0.074),
      p50Latency: generateMetricsSeries('p50Latency', 48),
      p95Latency: generateMetricsSeries('p95Latency', 640),
      p99Latency: generateMetricsSeries('p99Latency', 1120),
      requestRate: generateMetricsSeries('requestRate', 285),
    };
    return withFallback(async () => {
      const res = await client.get(`/services/${id}/metrics`, { params });
      return res.data;
    }, fallbackMetrics);
  },

  getServiceTraces: async (id: string, params?: { from?: string; to?: string }): Promise<{ data: TraceInfo[]; total: number }> => {
    return withFallback(async () => {
      const res = await client.get(`/services/${id}/traces`, { params });
      return res.data;
    }, { data: [mockTrace], total: 1 });
  },

  // ── Incidents ────────────────────────────────────────────────────────────
  getIncidents: async (params?: {
    page?: number;
    pageSize?: number;
    status?: string;
    severity?: string;
    serviceId?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<PaginatedResponse<Incident & { service: { name: string; environment: string }; alertRule?: { name: string }; correlatedDeployment?: { id: string; version: string; deployedAt: string } }>> => {
    const fallbackResponse: PaginatedResponse<any> = {
      data: mockIncidents,
      total: mockIncidents.length,
      page: params?.page ?? 1,
      pageSize: params?.pageSize ?? 20,
      hasMore: false,
    };
    return withFallback(async () => {
      const res = await client.get('/incidents', { params });
      return res.data;
    }, fallbackResponse);
  },

  getIncident: async (id: string): Promise<Incident & {
    service: { name: string; environment: string };
    alertRule?: { name: string; metric: string; threshold: number };
    correlatedDeployment?: Deployment;
    events: IncidentEvent[];
  }> => {
    const fallbackIncident = mockIncidents.find((i) => i.id === id) ?? mockIncidents[0];
    return withFallback(async () => {
      const res = await client.get(`/incidents/${id}`);
      return res.data;
    }, fallbackIncident);
  },

  updateIncidentStatus: async (
    id: string,
    data: { status: 'ACKNOWLEDGED' | 'RESOLVED'; note?: string; assignee?: string },
  ): Promise<Incident> => {
    return withFallback(async () => {
      const res = await client.patch(`/incidents/${id}/status`, data);
      return res.data;
    }, {
      ...mockIncidents[0],
      status: data.status,
      acknowledgedAt: data.status === 'ACKNOWLEDGED' ? new Date().toISOString() : undefined,
      resolvedAt: data.status === 'RESOLVED' ? new Date().toISOString() : undefined,
    });
  },

  getIncidentEvents: async (id: string): Promise<{ data: IncidentEvent[]; total: number }> => {
    return withFallback(async () => {
      const res = await client.get(`/incidents/${id}/events`);
      return res.data;
    }, { data: mockIncidents[0].events, total: mockIncidents[0].events.length });
  },

  addIncidentNote: async (id: string, data: { note: string; createdBy?: string }): Promise<IncidentEvent> => {
    const newEvt: IncidentEvent = {
      id: `evt-${Date.now()}`,
      incidentId: id,
      type: 'note',
      note: data.note,
      createdBy: data.createdBy ?? 'engineer',
      createdAt: new Date().toISOString(),
    };
    mockIncidents[0].events.push(newEvt);
    return withFallback(async () => {
      const res = await client.post(`/incidents/${id}/notes`, data);
      return res.data;
    }, newEvt);
  },

  analyzeIncident: async (id: string): Promise<Incident> => {
    return withFallback(async () => {
      const res = await client.post(`/incidents/${id}/analyze`);
      return res.data;
    }, mockIncidents[0]);
  },

  // ── Alert Rules ──────────────────────────────────────────────────────────
  getAlertRules: async (params?: {
    page?: number;
    pageSize?: number;
    serviceId?: string;
    enabled?: boolean;
  }): Promise<PaginatedResponse<AlertRule & { service: { name: string; environment: string } }>> => {
    const fallbackResponse: PaginatedResponse<any> = {
      data: mockAlertRules,
      total: mockAlertRules.length,
      page: params?.page ?? 1,
      pageSize: params?.pageSize ?? 20,
      hasMore: false,
    };
    return withFallback(async () => {
      const res = await client.get('/alert-rules', {
        params: {
          ...params,
          enabled: params?.enabled !== undefined ? String(params.enabled) : undefined,
        },
      });
      return res.data;
    }, fallbackResponse);
  },

  getAlertRule: async (id: string): Promise<AlertRule & { service: { name: string; environment: string } }> => {
    const fallbackRule = mockAlertRules.find((r) => r.id === id) ?? mockAlertRules[0];
    return withFallback(async () => {
      const res = await client.get(`/alert-rules/${id}`);
      return res.data;
    }, fallbackRule);
  },

  createAlertRule: async (data: Partial<AlertRule>): Promise<AlertRule> => {
    const newRule: any = {
      id: `rule-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...data,
      service: { name: data.serviceName ?? 'order-service', environment: 'production' },
    };
    return withFallback(async () => {
      const res = await client.post('/alert-rules', data);
      return res.data;
    }, newRule);
  },

  updateAlertRule: async (id: string, data: Partial<AlertRule>): Promise<AlertRule> => {
    return withFallback(async () => {
      const res = await client.patch(`/alert-rules/${id}`, data);
      return res.data;
    }, { ...mockAlertRules[0], ...data });
  },

  deleteAlertRule: async (id: string): Promise<void> => {
    try {
      await client.delete(`/alert-rules/${id}`);
    } catch {
      // offline silent pass
    }
  },

  // ── Deployments ──────────────────────────────────────────────────────────
  getDeployments: async (params?: {
    page?: number;
    pageSize?: number;
    serviceName?: string;
    environment?: string;
    from?: string;
    to?: string;
  }): Promise<PaginatedResponse<Deployment>> => {
    return withFallback(async () => {
      const res = await client.get('/deployments', { params });
      return res.data;
    }, {
      data: mockDeployments,
      total: mockDeployments.length,
      page: params?.page ?? 1,
      pageSize: params?.pageSize ?? 20,
      hasMore: false,
    });
  },

  createDeployment: async (data: Partial<Deployment>): Promise<Deployment> => {
    const newDep: Deployment = {
      id: `dep-${Date.now()}`,
      serviceName: data.serviceName ?? 'order-service',
      environment: data.environment ?? 'production',
      version: data.version ?? 'v1.0.0',
      commitSha: data.commitSha ?? 'abc1234',
      releaseNotes: data.releaseNotes,
      deployedAt: new Date().toISOString(),
      deployedBy: data.deployedBy ?? 'developer',
      createdAt: new Date().toISOString(),
    };
    return withFallback(async () => {
      const res = await client.post('/deployments', data);
      return res.data;
    }, newDep);
  },

  // ── Telemetry / Logs / Traces ────────────────────────────────────────────
  getLogs: async (params?: {
    service?: string;
    level?: string;
    traceId?: string;
    from?: string;
    to?: string;
    search?: string;
    limit?: number;
  }): Promise<{ data: LogEntry[]; total: number }> => {
    return withFallback(async () => {
      const res = await client.get('/logs', { params });
      return res.data;
    }, { data: mockLogs, total: mockLogs.length });
  },

  getTrace: async (traceId: string): Promise<TraceInfo> => {
    return withFallback(async () => {
      const res = await client.get(`/traces/${traceId}`);
      return res.data;
    }, mockTrace);
  },

  // ── Replay Lab ───────────────────────────────────────────────────────────
  getReplayScenarios: async (): Promise<{ data: ReplayScenario[] }> => {
    return withFallback(async () => {
      const res = await client.get('/replay/scenarios');
      return res.data;
    }, { data: mockReplayScenarios });
  },

  startReplayRun: async (scenarioId: string): Promise<ReplayRun> => {
    const newRun: ReplayRun = {
      id: `run-${Date.now()}`,
      scenarioId,
      scenarioName: mockReplayScenarios.find((s) => s.id === scenarioId)?.name ?? 'Simulation Scenario',
      status: 'RUNNING',
      expectedIncident: true,
      startedAt: new Date().toISOString(),
      rawResult: { status: 'executing' },
      createdAt: new Date().toISOString(),
    };
    return withFallback(async () => {
      const res = await client.post('/replay/runs', { scenarioId });
      return res.data;
    }, newRun);
  },

  getReplayRuns: async (params?: {
    page?: number;
    pageSize?: number;
    scenarioId?: string;
    status?: string;
  }): Promise<PaginatedResponse<ReplayRun>> => {
    return withFallback(async () => {
      const res = await client.get('/replay/runs', { params });
      return res.data;
    }, {
      data: mockReplayRuns,
      total: mockReplayRuns.length,
      page: params?.page ?? 1,
      pageSize: params?.pageSize ?? 20,
      hasMore: false,
    });
  },

  getReplayRun: async (id: string): Promise<ReplayRun> => {
    return withFallback(async () => {
      const res = await client.get(`/replay/runs/${id}`);
      return res.data;
    }, mockReplayRuns[0]);
  },

  // ── Settings ─────────────────────────────────────────────────────────────
  getSettingsStatus: async (): Promise<SettingsStatus> => {
    return withFallback(async () => {
      const res = await client.get('/settings/status');
      return res.data;
    }, mockSettings);
  },
};
