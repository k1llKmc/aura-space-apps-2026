# Backend contracts — crew health, revision 1

Status: crew endpoints, validation and daily-check persistence implemented.
Authentication and clinical assessment remain future work. This document refines tech_spec.md sections
4.2–4.3; in a conflict, this revision governs those endpoints.

## Common conventions

- Base path: `/api/v1`. JSON request/response, UTF-8.
- IDs: UUID strings. Timestamps: ISO 8601 UTC, serialized with `Z`.
- Unknown request fields are rejected, numbers are not coerced from strings.
- Authentication target: onboard JWT. Commander and medical roles may access crew
  within their mission; crew may access their own profile/checks. Missing or invalid
  JWT returns 401; forbidden actions return 403. Role names and identity storage
  will be implemented in the authentication iteration; endpoints must not be
  described as protected until guards exist.
- Errors: `{ statusCode: number, error: string, message: string[], timestamp: string }`.
  `error` uses HTTP reason phrases, e.g. `Bad Request`, not `BAD_REQUEST`.
- 400: invalid payload/UUID; 404: unknown crew member within authorized scope;
  409: daily check already exists or idempotency key reused with another payload;
  500: unexpected internal error without database details.

## Status and freshness rules

Allowed display statuses: `NOMINAL`, `ATTENTION`, `CRITICAL`, `OUTDATED`.
`ELEVATED` in the original mission example is normalized to `ATTENTION`.
Simulator values such as `MITIGATED` and `STABLE` are separate outcome labels.

Risk and freshness are independent:

- `riskStatus`: `NOMINAL | ATTENTION | CRITICAL | null`.
- `dataState`: `CURRENT | STALE | MISSING`.
- `null` risk means no assessment is available. It must not be rendered as a
  healthy measurement. `NOMINAL` means an assessment explicitly found no active
  risk; it cannot be inferred merely from absence of alerts.
- Select the latest zone-specific record by `recordedAt DESC, id DESC`, excluding
  future-dated records. All sources use the same ordering in this iteration.
- `STALE` means `evaluatedAt - recordedAt > 7 * 24 hours`; exactly seven days is
  still `CURRENT`. Missing records produce `MISSING`, with `lastChecked`,
  `sourceType`, and `metrics` all `null`.
- `isOutdated` is true for both `STALE` and `MISSING`. Compute it at read time;
  the stored flag is a cache and cannot override the timestamp calculation.
- Display status: CRITICAL risk first, then ATTENTION risk; otherwise OUTDATED
  for stale/missing data or unknown risk; otherwise NOMINAL.
- Overall status: CRITICAL if any zone or active crew-specific alert is CRITICAL;
  else ATTENTION if any is ATTENTION; else OUTDATED if any zone is OUTDATED;
  else NOMINAL. Resolved alerts do not contribute. `hasOutdatedData` remains true
  even if the overall display status is CRITICAL or ATTENTION.
- Current Alert rows have no zone link. Crew-specific alerts affect overall risk
  only; do not infer a body zone from hazard type or alert message text. Mission
  alerts belong to Mission Control and do not automatically diagnose all crew.
- Persisted CrewMember.status is a cache, not the authority for this response.

No clinical thresholds or automatic diagnoses are introduced in this iteration.
Baseline comparisons need an explicit metric/unit mapping and approved rule set;
until an assessment exists, zone `riskStatus` is null. The seed keys `IOP` and
`intraocularPressure`, for example, must not be compared by guessed semantics.

Mission follow-up: use the same risk priority (CRITICAL > ATTENTION > NOMINAL)
with freshness separate. Environment status must include relevant environmental
hazards, not only radiation. Environment timestamps/freshness and no-record behavior
need a separate mission-contract revision before changing that existing endpoint.

## GET /crew/:id/health

200 returns `CrewHealthResponse` defined in
`apps/api/src/modules/crew/crew.contracts.ts`. Return exactly five zones in this
order: HEAD_EYES, CHEST_CARDIO, ABDOMEN_METABOLISM, WHOLE_BODY_IMMUNE,
SKELETON_MUSCLES. A known crew member without health records still returns 200.

`evaluatedAt` is captured once for the response so all freshness calculations
share a clock. `message` is explanatory display text; clients branch on structured
fields. `metrics` contains only the selected record, never fabricated defaults.

## POST /crew/checks

Required header: `Idempotency-Key: <UUID>`. Body is validated by
`dailyHealthCheckSchema` in the backend contract file:

- `crewMemberId`: UUID; `sourceType`: exactly MANUAL_REPORT.
- Mood/stress/fatigue: integers 1–10. Higher mood is better; higher stress/fatigue
  means greater severity. These are input scales, not risk thresholds.
- `sleepHours`: finite number 0–24, describing the preceding 24 hours.
- `symptoms`: at most 20 unique, trimmed, case-sensitive strings, each 1–100
  characters; empty array means no reported symptoms. Free text is accepted
  because the seed currently uses human-readable labels.
- `notes`: required string, trimmed, maximum 2000 characters; may be empty.

Server assigns recordedAt and checkDate (UTC YYYY-MM-DD). One accepted check per
crew member per UTC date. Initial success returns 201 and 50 XP. A second key for
the same date returns 409 without a write or reward. No client timestamp/backdating.

Same key + same normalized payload returns 200 with the original success body;
same key + different normalized payload returns 409. Comparison includes crew ID.
In this iteration keys are scoped to crewMemberId and this endpoint; authentication
is not yet available. Before deployment, add identity/mission guards and enforce
authorization before replay; never treat a crew UUID as proof of permission.
Retain keys with the check for the lifetime of the
check; a replay returns the original recordedAt, streak and XP, without awarding
XP again. The response xpEarned describes that original operation.

Streak = consecutive UTC dates with accepted checks ending at checkDate, inclusive.
First check = 1; a skipped UTC date resets to 1. Enforce date uniqueness and
idempotency atomically in the database, including concurrent requests.

Daily checks are whole-person self reports stored with zone = null. They do not
refresh diagnostic zones, clear alerts, or imply fresh OCT/device measurements.
New clinical assessments and alert resolution are separate operations.

## Implementation and remaining work

1. Implemented controller/service and strict Zod validation. The unused global
   class-validator ValidationPipe was removed because its dependencies were absent.
2. Implemented DailyHealthCheck with durable date, payload/result, XP and streak,
   unique crew/date and crew/key constraints. Creation of the check and whole-person
   HealthRecord uses a serializable transaction with bounded conflict retries.
3. Implemented freshness/status aggregation. Update frontend response types when
   connecting the new endpoints. Existing frontend types are preliminary and lack
   nullable missing-data fields and the new structured status fields.
4. Maintain tests for missing records, exact seven-day boundary, stale critical data,
   resolved alerts, no zone inference, input boundaries, UTC rollover, streak gaps,
   concurrent submissions and idempotent replay.

Zone risk is currently unknown for all zones because there is no persisted clinical
assessment. Fresh measurements therefore still display OUTDATED (unknown assessment)
with dataState CURRENT and isOutdated false. Clients must show both fields. Crew
alerts may elevate overallStatus, but are not assigned to zones. Mission API behavior
is unchanged. Automatic zone assessment is a separate future feature.
