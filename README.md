# AURA

Next.js frontend, NestJS API/worker, PostgreSQL 16 and Redis 7. Requires Node.js 22+
and Docker Compose v2 with Docker Engine running.

## One-command local launch

From the repository root:

```sh
npm start
```

No host npm install is required for this Docker path. The launcher creates root
`.env` from `.env.example` if missing, then runs `docker compose up --build -d --wait`.
Open http://localhost:3000. API: http://localhost:3001/api/v1/missions/current.
Custom ports are configured with WEB_PORT and API_PORT in root `.env`.

Startup waits for PostgreSQL/Redis health, applies migrations, seeds only when
there are no missions, checks the initial seed, then starts API, worker and web. Restarting
does not reseed or overwrite operational records. A failed migration/bootstrap
prevents API startup. Named PostgreSQL volume persists data across shutdowns.

```sh
docker compose logs -f bootstrap api worker web
docker compose down
npm start
```

`down` preserves the database. Do not add `-v` unless you intend to delete it.
The bundled stack binds ports to localhost; business endpoints require a Bearer JWT.

## Shared environment

Use only root `.env`; do not create app-specific env files. POSTGRES_DB,
POSTGRES_USER and POSTGRES_PASSWORD are the single source for both DB and client
credentials. Passwords are URL-encoded by the launcher. The local PostgreSQL
connection does not request TLS. Changing credentials after the PostgreSQL volume
has been initialized requires updating the existing DB credentials separately.

Local commands derive DATABASE_URL/DIRECT_URL/REDIS_URL using host ports.
Compose uses service DNS names and fixed internal ports, with the same credentials.
For local development against external services, exported DATABASE_URL, DIRECT_URL,
REDIS_URL override derived values. External services must specify their required
TLS options. Compose itself always uses its bundled database and Redis.

Browser requests use relative `/api/v1`; Next.js proxies them to the backend.
Development proxy uses API_PORT. The Docker web build targets `http://api:3001`;
that internal destination is fixed at build time, while published ports may change.

## Local development

```sh
npm ci
docker compose up -d postgres redis
npm run db:generate
npm run db:setup
npm run dev
```

`db:setup` migrates, seeds an empty database and provisions the first account. `dev` builds API
with TypeScript decorator metadata, watches/restarts API/worker and starts Next.js with
hot reload. Ctrl+C stops the processes. Run `docker compose down` after finishing.
If the full stack is already running, stop its api/web containers before starting
local development on the same ports.

```sh
npm run db:migrate
npm run db:seed
npm run db:smoke
npm run web:build
npm --workspace apps/api test
```

Smoke checks expect the pristine development seed counts. For database-backed API
tests, export AURA_TEST_DATABASE_URL pointing to a separate migrated test database.
Tests create/delete their own fixture; never use a production database.

## Crew API

- GET `/api/v1/crew/:id/health`: five zones, freshness and crew warnings.
- POST `/api/v1/crew/checks`: manual daily check, required UUID Idempotency-Key;
  201 on creation, 200 on replay, 409 on conflict.

Contracts: [.ai_context/backend_contracts.md](.ai_context/backend_contracts.md).
Built-in clinical cutoffs are not supplied; operators configure reference limits.
JWT and mission access guards are enabled.

## Login and access

First launch generates JWT_SECRET and AUTH_BOOTSTRAP_PASSWORD in root `.env`.
Open the site and sign in with AUTH_BOOTSTRAP_USERNAME (default `commander`) and
that password. Keep `.env` private. Existing accounts are not reset on restart;
changing AUTH_BOOTSTRAP_PASSWORD after provisioning does not change a stored password.

Commander can provision mission accounts using POST `/api/v1/auth/users`.
Passwords must contain 12–128 characters. Crew Member accounts require a linked
crew profile. Users cannot choose an arbitrary mission at login or account creation.
Tokens expire after 15 minutes. The frontend keeps them only in memory, so reload
requires login. Logout revokes all tokens for that account. There is no refresh-token
or password-recovery flow in this iteration. Login limiting is in-memory per API
instance; this stack uses one API node.

New API contracts and the permissions table are documented in
[.ai_context/auth_contracts.md](.ai_context/auth_contracts.md). Shared request/response
types and status aggregation live in `packages/shared-types`.

`GET /api/v1/health` is the only public readiness endpoint; it returns no mission
or medical data. Docker health checks use it. The mission endpoint now requires login.

## Verification limits

Backend build, migrations, repeated bootstrap/seed, API tests and the frontend
proxy are checked locally. Container image build and Compose end-to-end startup
require Docker; they must be verified on a Docker-equipped host before deployment.

## Frontend workspace

The signed-in app includes Mission Control, Crew Overview, Crew Profile, Daily
Health Check, Alerts, Mission Risk Simulator, Countermeasure Protocols and
Settings / Access. A shared responsive shell provides mission context, delay,
navigation, breadcrumbs, notifications and session controls. Forms and tables
use the authenticated API; permissions follow the signed-in account.
Commander can create mission accounts from Settings / Access.

Architecture, routes and current capability boundaries:
[.ai_context/frontend_architecture.md](.ai_context/frontend_architecture.md).

Run the browser journey against a disposable seeded Docker stack:

```sh
npm ci
npx playwright install chromium
npm start
node scripts/web-e2e-fixtures.mjs
npm run test:web
node scripts/web-e2e-fixtures.mjs cleanup
```

Always run fixture cleanup, including after a failed test. Fixtures use unique
synthetic records and ignored local credentials. The test uses the bootstrap
account from root `.env`; its password must match the provisioned account.
`E2E_BASE_URL` optionally overrides the web address; `E2E_BROWSER_PATH` selects an
installed Chromium executable. For native development, export the isolated DB
connection and set `E2E_NATIVE=1` for fixture commands. GitHub Actions verifies the
browser journey, full Docker startup and restart on every push.

## Crew health development

The signed-in site now includes crew profiles, five zone assessments, independent
risk/freshness labels, medical history, reference versions and a scoped activity
journal. Commander/Medical Officer can add measurements and configure reference
rules. Thresholds are operator-supplied; no clinical cutoffs are built in. The legacy
demo seed lacks versioned rules/measurement units and will show unassessed risk
until compatible data is entered. Use synthetic test data only for demonstrations.

API and calculation details: [.ai_context/health_rules.md](.ai_context/health_rules.md).
The worker checks freshness through BullMQ every 60 seconds. Configure this with
HEALTH_SWEEP_ENABLED and HEALTH_SWEEP_INTERVAL_SECONDS in root `.env`.
Acknowledging a warning does not alter the underlying risk or freshness.
The seed smoke test permits additional generated warnings after API startup.

## Telemetry and jobs

POST `/api/v1/telemetry` accepts health/environment events and returns 202 with
jobId and statusUrl. Supported provenance: AUTO_TELEMETRY, MANUAL_REPORT,
DIAGNOSTIC_DEVICE. GET `/api/v1/jobs/:id` reports progress/result;
POST `/api/v1/jobs/:id/retry` retries a failed accessible task. All require JWT and
mission/profile permissions. Input event identity is immutable and deduplicated.

PostgreSQL stores accepted payloads/results; Redis/BullMQ transports task IDs.
Temporary Redis failure leaves saved events pending. The worker outbox dispatcher
recovers them. Five automatic attempts use exponential backoff; a durable record
is not duplicated if later evaluation fails. Redis uses AOF/noeviction and a named
volume. `docker compose down` preserves both PostgreSQL and Redis data.

POST `/api/v1/simulator/run` queues BASELINE_PROJECTION jobs with a UUID
Idempotency-Key. This is a hypothetical baseline comparison, not the full future
solar-storm/gravity simulation model. Simulations do not alter clinical data.

Details and payload examples: [.ai_context/telemetry_jobs.md](.ai_context/telemetry_jobs.md).
Set AURA_TEST_DATABASE_URL and AURA_TEST_REDIS_URL to isolated services for the
queue integration test. QUEUE_PREFIX isolates queue namespaces; WORKER_CONCURRENCY
defaults to 4. TASK_QUEUE_ENABLED=false is only for isolated tests. API readiness
checks DB/Redis; worker readiness uses a 15-second heartbeat. API, worker and Redis
must all run for automatic processing. Frontend refreshes telemetry every 15 seconds.
