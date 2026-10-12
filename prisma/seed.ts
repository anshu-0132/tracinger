import { PrismaClient, AlertSeverity, AlertMetric, AlertOperator, IncidentStatus, NotificationChannel, ReplayRunStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // 1. Seed Services
  const orderService = await prisma.service.upsert({
    where: { name_environment: { name: 'order-service', environment: 'production' } },
    update: {},
    create: {
      name: 'order-service',
      environment: 'production',
      description: 'Core order processing, checkout pipeline, and order lifecycle management',
      tags: ['tier-1', 'checkout', 'revenue-critical'],
    },
  });

  const inventoryService = await prisma.service.upsert({
    where: { name_environment: { name: 'inventory-service', environment: 'production' } },
    update: {},
    create: {
      name: 'inventory-service',
      environment: 'production',
      description: 'Warehouse stock tracking, reservation locks, and SKU availability catalog',
      tags: ['tier-1', 'warehouse', 'catalog'],
    },
  });

  const paymentService = await prisma.service.upsert({
    where: { name_environment: { name: 'payment-service', environment: 'production' } },
    update: {},
    create: {
      name: 'payment-service',
      environment: 'production',
      description: 'Secure credit card authorization and payment gateway integration',
      tags: ['tier-1', 'payments', 'pci-dss'],
    },
  });

  const notificationService = await prisma.service.upsert({
    where: { name_environment: { name: 'notification-service', environment: 'production' } },
    update: {},
    create: {
      name: 'notification-service',
      environment: 'production',
      description: 'Customer notification delivery pipeline for transactional SMS and emails',
      tags: ['tier-2', 'notifications', 'async'],
    },
  });

  console.log('✅ Services created');

  // 2. Seed Alert Rules
  const rule1 = await prisma.alertRule.create({
    data: {
      name: 'High HTTP 5xx Error Rate',
      description: 'Fires when order-service 5xx error rate exceeds 5% for over 1 minute',
      serviceId: orderService.id,
      metric: AlertMetric.ERROR_RATE,
      operator: AlertOperator.GREATER_THAN,
      threshold: 0.05,
      windowMinutes: 5,
      pendingMinutes: 1,
      severity: AlertSeverity.HIGH,
      sloTarget: 0.999,
      sloBudgetMinutes: 43200, // 30 days
      enabled: true,
    },
  });

  const rule2 = await prisma.alertRule.create({
    data: {
      name: 'Critical P95 Latency Degradation',
      description: 'Fires when order-service p95 latency exceeds 1000ms',
      serviceId: orderService.id,
      metric: AlertMetric.P95_LATENCY,
      operator: AlertOperator.GREATER_THAN,
      threshold: 1000,
      windowMinutes: 5,
      pendingMinutes: 1,
      severity: AlertSeverity.CRITICAL,
      enabled: true,
    },
  });

  const rule3 = await prisma.alertRule.create({
    data: {
      name: 'Inventory Stock Check Timeout / Error',
      description: 'Triggers when inventory-service returns elevated error rates above 5%',
      serviceId: inventoryService.id,
      metric: AlertMetric.ERROR_RATE,
      operator: AlertOperator.GREATER_THAN,
      threshold: 0.05,
      windowMinutes: 5,
      pendingMinutes: 1,
      severity: AlertSeverity.HIGH,
      enabled: true,
    },
  });

  const rule4 = await prisma.alertRule.create({
    data: {
      name: 'Payment Service Availability SLO Breach',
      description: 'SLO burn-rate alert when payment availability drops below 99.9%',
      serviceId: paymentService.id,
      metric: AlertMetric.AVAILABILITY,
      operator: AlertOperator.LESS_THAN,
      threshold: 0.999,
      windowMinutes: 15,
      pendingMinutes: 2,
      severity: AlertSeverity.CRITICAL,
      sloTarget: 0.999,
      sloBudgetMinutes: 43200,
      enabled: true,
    },
  });

  console.log('✅ Alert rules created');

  // 3. Seed Deployments
  const now = new Date();
  const dep1 = await prisma.deployment.create({
    data: {
      serviceName: 'order-service',
      environment: 'production',
      version: 'v2.4.1',
      commitSha: '8f9b2a1c',
      releaseNotes: 'Optimized concurrent order checkout database pooling and connection reuse',
      deployedAt: new Date(now.getTime() - 25 * 60 * 1000), // 25 mins ago
      deployedBy: 'ci-github-actions',
    },
  });

  const dep2 = await prisma.deployment.create({
    data: {
      serviceName: 'inventory-service',
      environment: 'production',
      version: 'v1.9.0',
      commitSha: '4c3d2e1b',
      releaseNotes: 'Replaced single-row stock query with batch cache index lookup',
      deployedAt: new Date(now.getTime() - 90 * 60 * 1000), // 90 mins ago
      deployedBy: 'alex.dev@tracinger.internal',
    },
  });

  await prisma.deployment.create({
    data: {
      serviceName: 'order-service',
      environment: 'production',
      version: 'v2.4.0',
      commitSha: '1a2b3c4d',
      releaseNotes: 'Added OpenTelemetry baggage propagation headers to downstream requests',
      deployedAt: new Date(now.getTime() - 48 * 60 * 60 * 1000), // 2 days ago
      deployedBy: 'release-bot',
    },
  });

  console.log('✅ Deployments registered');

  // 4. Seed Representative Incidents (with realistic Incident Intelligence evidence)
  const incident1 = await prisma.incident.upsert({
    where: { fingerprint: 'incident-order-service-err-rate-active' },
    update: {},
    create: {
      fingerprint: 'incident-order-service-err-rate-active',
      serviceId: orderService.id,
      alertRuleId: rule1.id,
      severity: AlertSeverity.HIGH,
      status: IncidentStatus.OPEN,
      title: 'Elevated 5xx Error Rate on order-service (18.4% vs 5.0% threshold)',
      description: 'Threshold breach: HTTP 5xx error rate spiked to 18.4% across 142 req/sec following v2.4.1 deployment.',
      startedAt: new Date(now.getTime() - 20 * 60 * 1000),
      detectedAt: new Date(now.getTime() - 19 * 60 * 1000),
      currentValue: 0.184,
      threshold: 0.05,
      correlatedDeploymentId: dep1.id,
      evidenceJson: [
        {
          rank: 1,
          score: 85,
          candidateType: 'deployment',
          candidateId: dep1.id,
          candidateLabel: 'order-service v2.4.1 (deployed 5 min prior)',
          explanation: 'order-service deployment v2.4.1 occurred 5 minutes before error rate exceeded threshold. Database connection pool errors correlate directly with new connection release logic.',
          evidence: [
            {
              type: 'deployment_proximity',
              weight: 25,
              description: 'Deployment v2.4.1 occurred 5 minutes prior to incident detection',
              timestamp: dep1.deployedAt.toISOString(),
            },
            {
              type: 'error_spike',
              weight: 30,
              description: 'HTTP 5xx rate spiked from 0.02% to 18.4% (threshold 5%)',
              value: 0.184,
              threshold: 0.05,
            },
            {
              type: 'log_burst',
              weight: 10,
              description: 'Observed 34 ERROR log records per minute citing ECONNRESET',
            },
          ],
          missingEvidence: [],
          telemetryLinks: [
            {
              type: 'metrics',
              label: 'order-service Error Metrics',
              url: 'http://localhost:3000/explore?orgId=1&left=%5B%22now-1h%22,%22now%22,%22Prometheus%22,%7B%22expr%22:%22rate(http_server_request_duration_seconds_count%7Bhttp_response_status_code%3D~%5C%225..%5C%22%7D%5B5m%5D)%22%7D%5D',
            },
            {
              type: 'logs',
              label: 'order-service 5xx Logs in Loki',
              url: 'http://localhost:3000/explore?orgId=1&left=%5B%22now-1h%22,%22now%22,%22Loki%22,%7B%22expr%22:%22%7Bservice_name%3D%5C%22order-service%5C%22%7D%20%7C%3D%20%5C%22error%5C%22%22%7D%5D',
            },
          ],
        },
        {
          rank: 2,
          score: 45,
          candidateType: 'dependency',
          candidateId: 'inventory-service',
          candidateLabel: 'inventory-service HTTP client timeout',
          explanation: 'Downstream inventory stock reservation endpoint /inventory/reserve experienced intermittent latency increases.',
          evidence: [
            {
              type: 'dependency_failure',
              weight: 25,
              description: '12% of outbound calls from order-service to inventory-service timed out after 1000ms',
            },
            {
              type: 'latency_spike',
              weight: 20,
              description: 'p95 latency on /orders checkout endpoint reached 1240ms',
              value: 1240,
              threshold: 1000,
            },
          ],
          missingEvidence: ['inventory-service internal CPU saturation not observed'],
          telemetryLinks: [
            {
              type: 'trace',
              label: 'Sample Failing Trace (Trace ID: 7f8a9b0c)',
              url: 'http://localhost:3000/explore?orgId=1&left=%5B%22now-1h%22,%22now%22,%22Tempo%22,%7B%22query%22:%227f8a9b0c%22%7D%5D',
            },
          ],
        },
      ],
      investigationNotes: 'Root cause candidate ranked #1 is deployment v2.4.1 due to immediate temporal correlation and connection pool exhaustion logs.',
    },
  });

  // Events for incident 1
  await prisma.incidentEvent.createMany({
    data: [
      {
        incidentId: incident1.id,
        type: 'incident_opened',
        toStatus: 'OPEN',
        note: 'Alert rule "High HTTP 5xx Error Rate" breached continuously for 1m (threshold: 0.05, value: 0.184)',
        createdBy: 'Tracinger Alert Engine',
        createdAt: new Date(now.getTime() - 19 * 60 * 1000),
      },
      {
        incidentId: incident1.id,
        type: 'deployment_correlated',
        toStatus: 'OPEN',
        note: 'Deployment correlation engine linked order-service v2.4.1 (deployed at -25m)',
        createdBy: 'Incident Intelligence Engine',
        createdAt: new Date(now.getTime() - 18 * 60 * 1000),
      },
    ],
  });

  // A resolved historical incident
  const incident2 = await prisma.incident.upsert({
    where: { fingerprint: 'incident-inventory-service-p99-resolved' },
    update: {},
    create: {
      fingerprint: 'incident-inventory-service-p99-resolved',
      serviceId: inventoryService.id,
      alertRuleId: rule3.id,
      severity: AlertSeverity.MEDIUM,
      status: IncidentStatus.RESOLVED,
      title: 'Elevated P99 Latency on inventory-service (840ms)',
      description: 'Temporary database lock contention during scheduled catalog re-indexing.',
      startedAt: new Date(now.getTime() - 5 * 60 * 60 * 1000),
      detectedAt: new Date(now.getTime() - 5 * 60 * 60 * 1000 + 60 * 1000),
      acknowledgedAt: new Date(now.getTime() - 4 * 60 * 60 * 1000),
      resolvedAt: new Date(now.getTime() - 3 * 60 * 60 * 1000),
      assignee: 'sre-oncall',
      currentValue: 24,
      threshold: 800,
      evidenceJson: [
        {
          rank: 1,
          score: 70,
          candidateType: 'service',
          candidateId: 'inventory-service',
          candidateLabel: 'inventory-service DB lock contention',
          explanation: 'Catalog vacuuming triggered table lock on SKU inventory items.',
          evidence: [
            {
              type: 'latency_spike',
              weight: 20,
              description: 'P99 latency breached 800ms threshold for 8 consecutive minutes',
            },
          ],
          missingEvidence: [],
          telemetryLinks: [],
        },
      ],
      investigationNotes: 'Resolved automatically once maintenance lock was released.',
    },
  });

  console.log('✅ Incidents and timeline events created');

  // 5. Seed Notification Config
  await prisma.notificationConfig.upsert({
    where: { id: 'default-webhook-config' },
    update: {},
    create: {
      id: 'default-webhook-config',
      name: 'Incident Response Slack Webhook',
      channel: NotificationChannel.WEBHOOK,
      webhookUrl: 'http://localhost:3000/api/mock-webhook',
      enabled: true,
    },
  });

  console.log('✅ Notification configuration created');

  // 6. Seed Completed Replay Runs
  await prisma.replayRun.create({
    data: {
      scenarioId: 'http-5xx-burst',
      scenarioName: 'HTTP 5xx Burst Fault Injection',
      status: ReplayRunStatus.COMPLETED,
      startedAt: new Date(now.getTime() - 30 * 60 * 1000),
      completedAt: new Date(now.getTime() - 28 * 60 * 1000),
      incidentDetected: true,
      detectionDelayMs: 4200,
      expectedIncident: true,
      recovered: true,
      recoveryDelayMs: 6100,
      passed: true,
      notes: 'Controlled 5xx fault injected into order-service /orders/simulate-error. Prometheus scrape detected breach in 4.2s. Incident created and auto-recovered upon fault cessation.',
    },
  });

  await prisma.replayRun.create({
    data: {
      scenarioId: 'latency-spike',
      scenarioName: 'P95 Latency Spike (1500ms sleep)',
      status: ReplayRunStatus.COMPLETED,
      startedAt: new Date(now.getTime() - 15 * 60 * 1000),
      completedAt: new Date(now.getTime() - 13 * 60 * 1000),
      incidentDetected: true,
      detectionDelayMs: 5100,
      expectedIncident: true,
      recovered: true,
      recoveryDelayMs: 7300,
      passed: true,
      notes: 'Injected artificial 1500ms delay in inventory reservation. Evaluator detected breach in 5.1s.',
    },
  });

  // 7. Seed App Settings
  await prisma.appSetting.upsert({
    where: { key: 'evaluation_interval_seconds' },
    update: {},
    create: { key: 'evaluation_interval_seconds', value: '30' },
  });

  await prisma.appSetting.upsert({
    where: { key: 'deployment_lookback_minutes' },
    update: {},
    create: { key: 'deployment_lookback_minutes', value: '60' },
  });

  console.log('✨ Seed complete! Tracinger database is ready.');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
