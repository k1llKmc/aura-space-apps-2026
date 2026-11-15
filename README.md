# aura-space-apps-2026

Crew API contracts and status rules: [.ai_context/backend_contracts.md](.ai_context/backend_contracts.md).

## Crew backend

After installing dependencies and configuring DATABASE_URL and DIRECT_URL:

```sh
npm ci
npm run db:generate
npm run db:migrate
npm run db:seed
npm --workspace apps/api test
npm --workspace apps/api run start:dev
```

Prisma CLI reads `apps/api/.env`; the running API needs DATABASE_URL exported in
its environment. For a local PostgreSQL container, use matching credentials and
omit `sslmode=require` unless you have configured TLS. Root `.env` is consumed by
Compose, not automatically loaded by the running API.

- `GET /api/v1/crew/:id/health`: five body zones, measurement freshness and crew alerts.
- `POST /api/v1/crew/checks`: strict manual daily report, required UUID
  `Idempotency-Key` header; 201 initially, 200 on replay, 409 on conflicting submission.

These endpoints currently have **no authentication**. JWT/mission access guards
are required before deployment. No automatic clinical thresholds are implemented.

Unit and HTTP tests run without a database. To additionally run database-backed
tests (migrations must already be applied), set AURA_TEST_DATABASE_URL to an
isolated PostgreSQL database before running the API tests. Tests create and remove
their own mission fixture; never point this variable at production.
