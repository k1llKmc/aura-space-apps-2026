# AURA

Next.js frontend, NestJS API, PostgreSQL 16 and Redis 7. Requires Node.js 22+
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
there are no missions, checks the initial seed, then starts API and web. Restarting
does not reseed or overwrite operational records. A failed migration/bootstrap
prevents API startup. Named PostgreSQL volume persists data across shutdowns.

```sh
docker compose logs -f bootstrap api web
docker compose down
npm start
```

`down` preserves the database. Do not add `-v` unless you intend to delete it.
The bundled stack binds ports to localhost; authentication is not implemented yet.

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

`db:setup` explicitly migrates and seeds (for development only). `dev` builds API
with TypeScript decorator metadata, watches/restarts API and starts Next.js with
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
Clinical risk thresholds and JWT/mission access guards remain future work.

## Verification limits

Backend build, migrations, repeated bootstrap/seed, API tests and the frontend
proxy are checked locally. Container image build and Compose end-to-end startup
require Docker; they must be verified on a Docker-equipped host before deployment.
