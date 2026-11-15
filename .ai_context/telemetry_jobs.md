# Telemetry and background tasks — revision 1

Supersedes the API-process health timer. BullMQ 5/Redis 7 transport tasks to a
separate NestJS worker. PostgreSQL is authoritative for accepted payloads, task
state, durable results and idempotency. All endpoints below require onboard JWT.

## Telemetry contract

POST `/api/v1/telemetry` returns 202 AsyncTaskResponse, including jobId/statusUrl.

```json
{
  "eventId": "a2d2abe4-777f-4e7c-97a6-d1e82fcd6d49",
  "producerId": "cabin-device-1",
  "recordedAt": "2026-11-15T06:00:00.000Z",
  "kind": "HEALTH",
  "crewMemberId": "00000000-0000-4000-8000-000000000001",
  "measurement": {
    "zone": "CHEST_CARDIO",
    "sourceType": "AUTO_TELEMETRY",
    "metrics": { "heartRateResting": 68 },
    "units": { "heartRateResting": "bpm" },
    "symptoms": []
  }
}
```

eventId is UUID; producerId matches `[a-zA-Z0-9_.-]{3,64}`. recordedAt is required
ISO 8601 with timezone, normalized to UTC. Future dates and an additional timestamp
inside measurement are rejected. Canonical health metrics/units match health_rules.md.
Sources: AUTO_TELEMETRY, MANUAL_REPORT, DIAGNOSTIC_DEVICE. Unknown fields return 400.

ENVIRONMENT replaces crewMemberId/measurement with sourceType and metrics containing
all seven values: radiationCans (mSv/day), totalRadiation (mSv), pO2 (kPa), co2Ppm
(ppm), cabinPressure (kPa), temperature (C), humidity (%). Values are finite,
radiation/oxygen/CO2 nonnegative, pressure positive, humidity 0–100, CO2 <=1000000.
These are input bounds, not medical/environmental danger thresholds.

Commander/Medical Officer may send all sources for their mission. Crew Member may
send only own-profile MANUAL_REPORT health events. producerId is a stream label,
not hardware attestation; the authorized JWT producer asserts provenance. Device
provisioning/service-account authentication is not implemented in this iteration.

Idempotency scope: missionId + producerId + eventId, across sources/kinds. Same
normalized payload returns the original task/result after Redis cleanup as well.
Different input under that identity returns 409. Canonical hashing sorts object
keys. Permissions precede replay and are checked again at processing time.

## Durable processing and recovery

Acceptance saves BackgroundTask and its audit atomically, followed by best-effort
publish. Redis failure does not undo acceptance; 202 may describe a pending event.
Redis contains only taskId/generation, sanitized errors and operational metadata;
medical payloads and simulation results stay in PostgreSQL. BullMQ return values
are task references, not medical evidence.

The worker dispatches up to 100 pending tasks every two seconds. Unpublished tasks
are sent first. Pending/processing tasks published >30 seconds ago are safely
republished with the same BullMQ ID, recovering Redis loss or publish/DB gaps.
Redis uses AOF/everysec, noeviction and a named volume; it is not the sole durable
copy of accepted input.

Concurrency defaults to four (WORKER_CONCURRENCY, 1–32). Priorities: telemetry 1,
health recheck 3, simulation 10. Each generation gets up to five automatic attempts
with exponential backoff starting at one second. Permanent invalid input/revoked
access fails immediately. Workers reconnect indefinitely to Redis; producers fail
fast. Graceful shutdown waits for active work; stalled jobs may be redelivered.

State: PENDING -> PROCESSING -> COMPLETED; retryable failure -> PENDING; final
failure -> FAILED. attempts counts attempts successfully recorded in PostgreSQL
(a DB outage cannot record an attempt). Transport is at-least-once, with idempotent
effects, not an exactly-once delivery guarantee.

HealthRecord/EnvironmentRecord use the task ID as their ID. An advisory transaction
lock makes record creation and its single telemetry audit atomic. Health evaluation
then reconciles zone snapshots/alerts with the existing per-crew lock/dedup keys.
Completion is persisted after evaluation succeeds. A failed task may already have
a visible measurement if failure occurred after record creation. Retry the same
task/event identity, never a new eventId, to avoid duplicating an old observation.

## Job access and retry

GET `/api/v1/jobs/:id`: jobId, kind, state, attempts, generation, result, errorCode,
createdAt, updatedAt, statusUrl. No raw payload/credentials. Operators see their
mission; Crew Members only their own submitted tasks for their current own profile,
including after a role downgrade. Foreign-scope lookup returns 404.

POST `/api/v1/jobs/:id/retry`: 202 for an accessible FAILED task, otherwise 409.
Increments generation and writes TASK_RETRIED; older deliveries cannot overwrite
newer generations. Original producer authorization still applies: restore revoked
access before retrying. Public errors: ACCESS_REVOKED, INVALID_TASK,
PROCESSING_FAILED. Redis completed jobs retain up to one day/10000 entries; failed
jobs up to seven days/10000. DB results/event keys survive queue cleanup.

## Health schedules

BullMQ Job Scheduler health-scan starts on worker startup and repeats every
HEALTH_SWEEP_INTERVAL_SECONDS (default 60, range 10–86400). It creates durable
per-crew HEALTH_RECHECK jobs in batches of 50, allowing independent retries.
HEALTH_SWEEP_ENABLED=false removes that scheduler but leaves telemetry/explicit
rechecks active. Record/baseline writes also create health jobs in the same DB
transaction and return assessmentJobId. HTTP writes no longer generate warnings
synchronously. The original seven-day freshness/baseline-v1 semantics are retained.
Completed internal health tasks older than seven days are cleaned up; clinical
records, input event keys and simulation results are retained.

## Simulation jobs

POST `/api/v1/simulator/run`, operator role, UUID Idempotency-Key header:

```json
{
  "scenarioType": "BASELINE_PROJECTION",
  "crewMemberId": "00000000-0000-4000-8000-000000000001",
  "projection": {
    "zone": "CHEST_CARDIO",
    "sourceType": "DIAGNOSTIC_DEVICE",
    "metrics": { "heartRateResting": 68 },
    "units": { "heartRateResting": "bpm" },
    "symptoms": []
  }
}
```

202 returns the job; poll its status for the result. The worker uses the exact
baseline version captured at acceptance, not a later replacement. Result explicitly
says mode=SIMULATION and returns baselineId/modelVersion, risk, completeness and
evidence. It makes no observation freshness claim and changes no clinical record,
alert or crew status. Symptoms must be empty and recordedAt is forbidden. Unknown
scenario types return 400. Full solar-storm/gravity/isolation models and the
simulator UI remain the separate simulator stage; no clinical model is invented.

## Runtime and validation

`npm start` starts web/api/worker/PostgreSQL/Redis after bootstrap migrations.
`npm run dev` starts API/worker/frontend using root environment. Worker heartbeat
updates every three seconds and expires after 15 seconds; Docker checks it. API
readiness checks DB/Redis, returning 503 if unavailable, while existing API ingestion
can still save events during a Redis outage. TASK_QUEUE_ENABLED=false is for tests
only; a worker refuses to start with it. QUEUE_PREFIX isolates installations.
Frontend polls mission/profile every 15 seconds; operator forms poll assessmentJobId
briefly and distinguish queued/failed evaluation from successful data storage.

Real PostgreSQL/Redis integration tests use a unique schema and Redis prefix. They
cover all sources, authorization, concurrent duplicates, producer disconnection,
Redis job loss, restarts, revoked processing permissions, retry after a committed
record, exhausted retries/manual retry, scheduled warnings and simulation snapshots.

References:
- https://docs.bullmq.io/patterns/idempotent-jobs
- https://docs.bullmq.io/guide/connections
- https://docs.bullmq.io/guide/job-schedulers/
- https://docs.bullmq.io/guide/retrying-failing-jobs
