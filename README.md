# Tracinger

Tracinger is an application observability and incident investigation platform. It provides distributed tracing, metrics ingestion, automated root-cause correlation, and an SRE investigation console.

## Architecture

Monorepo organized with npm workspaces:

- `apps/web`: React 19 + TypeScript + Vite + Tailwind CSS dashboard
- `apps/api`: Fastify API serving telemetry ingestion, incidents, and query endpoints
- `apps/worker`: Background job processor for alert evaluation and metric rollups
- `apps/demo-order-service` & `demo-inventory-service`: Sample instrumented microservices
- `packages/shared`: Shared TypeScript types, schemas, and utilities
- `prisma/`: PostgreSQL schema and seed data

## Prerequisites

- Node.js 22+
- PostgreSQL 16+ (or Docker)

## Getting Started

### 1. Environment Setup

Copy the environment template:

```bash
cp .env.example .env
```

Ensure your PostgreSQL connection string in `.env` is correct.

### 2. Install & Database Setup

Install dependencies, generate Prisma client, run migrations, and seed sample data:

```bash
npm run setup
```

### 3. Start Development Servers

Run the web dashboard, API, and worker concurrently:

```bash
npm run dev
```

- **Web Dashboard**: http://localhost:5173
- **API Server**: http://localhost:4000
- **Health Check**: http://localhost:4000/health

_(Optional)_ Run the demo microservices to simulate live traffic and failures:

```bash
npm run dev:demo
```

### 4. Running with Docker

To spin up the entire stack with PostgreSQL:

```bash
docker compose up --build
```

## Testing & Verification

```bash
# Run unit and integration tests across all workspaces
npm run test

# Typecheck all packages
npm run typecheck

# Code formatting check
npm run format:check

# Production build
npm run build
```

## Key Capabilities

- **Distributed Tracing**: Waterfall timeline visualization with span hierarchy, latency breakdowns, and error flagging.
- **Incident Investigation**: Correlation engine matching latency spikes and error anomalies against recent deployments and commits.
- **Alert Rules & SLOs**: Threshold evaluation with error-budget burn tracking.
- **Incident Replay Lab**: Sandbox for replaying simulated failure scenarios (e.g. database pool exhaustion, cascading timeouts) and evaluating detection/recovery times.
