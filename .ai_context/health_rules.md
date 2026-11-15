# Crew health — baseline-v1

This revision supersedes the earlier statement that every zone has unknown risk.
Scheduling now uses the separate BullMQ worker documented in telemetry_jobs.md;
the older in-process timer/immediate evaluation description below is superseded.
The engine implements configurable reference comparisons, not disease diagnosis.
No universal clinical cutoffs are shipped. Configuring a rule is an authorized
operator action, not certification that the rule is medically validated.

NASA's SANS technical brief describes individual needs, clinical guidelines and
flight-surgeon expertise as inputs to preventive care; it does not validate this
application's formulas or catalogue:
https://www.nasa.gov/wp-content/uploads/2024/02/ochmo-mtb-001-sans.pdf

## Explicit zone catalogue

| Zone | Canonical metrics and units |
| --- | --- |
| HEAD_EYES | intraocularPressure (mmHg), octRetinalThickness (um), visualAcuity (ratio) |
| CHEST_CARDIO | heartRateResting (bpm), systolicPressure/diastolicPressure (mmHg) |
| ABDOMEN_METABOLISM | fastingGlucose (mmol/L), bodyMass (kg) |
| WHOLE_BODY_IMMUNE | whiteBloodCells (10^9/L), cReactiveProtein (mg/L) |
| SKELETON_MUSCLES | muscleMass (kg), boneMineralDensity (g/cm2), spineTScore (score) |

This is a software input catalogue, not an exhaustive clinical examination.
GET `/api/v1/crew/health/rules-catalog` returns the same shared catalogue.
Each metric rule explicitly supplies unit, reference value, ABSOLUTE or PERCENT
comparison, INCREASE/DECREASE/BOTH direction, positive attentionDelta,
criticalDelta > attentionDelta, and allowedSources. Percentage comparison forbids
a zero reference. A zone may have one rule per metric and up to ten rules.

For observed value x and reference b:

- INCREASE: d = max(0, x-b).
- DECREASE: d = max(0, b-x).
- BOTH: d = abs(x-b).
- ABSOLUTE: deviation = d, in the configured metric unit.
- PERCENT: deviation = 100*d/abs(b).
- CRITICAL when deviation >= criticalDelta; else ATTENTION when deviation >=
  attentionDelta; else NOMINAL for that metric.

Exact boundaries are inclusive. Missing/non-finite values, unsupported sources,
unit mismatches and numeric overflow produce unknown metric risk, never NOMINAL.
No unit conversion or legacy-key aliases are inferred. Seed keys such as IOP and
OCT_thickness and seed measurements without explicit units remain unassessed until
an operator supplies a versioned policy and compatible measurements.

Zone risk is the highest observed ATTENTION/CRITICAL risk, even with incomplete
coverage. NOMINAL requires valid comparisons for every configured metric; otherwise
riskStatus is null. assessmentComplete and evidence describe coverage and reasons.
NOMINAL only describes configured comparisons, not clearance for the entire zone.

## Selection, freshness and explainability

Select latest measurement per zone by recordedAt DESC, id DESC, excluding future
records. Select latest baseline version by createdAt DESC, id DESC. New versions
apply to existing measurements; old comparisons are preserved in change-journal
events. A newer incompatible-source measurement makes risk unknown rather than
falling back silently to an older measurement. Daily reports have zone=null and
never refresh zone-specific measurements.

Freshness is independent: MISSING with no record; STALE strictly beyond seven
24-hour periods; CURRENT at exactly seven days. Baselines are fixed references,
not measurements subject to the seven-day expiry. Stale measurements retain their
calculated risk, labelled STALE. Unknown assessment with current data is explicitly
shown as `Risk: Not assessed / Data: CURRENT` on the frontend. Legacy combined
status remains for compatibility; it is not used as the freshness/risk label.

HealthZoneStatus includes recordId, baselineId, baseline-v1 rulesVersion, evidence
(metric, current, baseline, unit, deviation, comparison, risk and explanation), and
assessmentComplete. GET health computes these live without writing audit events.

## API additions

All require JWT and the existing mission/profile authorization.

- GET `/crew/:id/records`: paginated history, optional zone/sourceType/from/to.
  Dates are ISO 8601; from <= to. Future records are excluded. Freshness is computed
  on read rather than trusted from the cached isOutdated flag.
- POST `/crew/:id/records`: Commander/Medical Officer only. Strict HealthRecordRequest,
  canonical metrics and units, at least one metric, optional recordedAt (no future
  dates). Returns 201. Raw records and their creation audit are atomic.
- GET `/crew/:id/baselines`: paginated versions, optional zone.
- POST `/crew/:id/baselines`: Commander/Medical Officer only. Strict BaselineRequest
  with reason and full rule set. Returns 201; always appends a new version. There
  is no update/delete endpoint for medical records or baseline versions.
- GET `/audit`: paginated mission journal, optional crewMemberId. Operators see
  their mission; Crew Members see only their own profile events. Foreign profiles
  are rejected. Read operations do not generate journal spam.

Lists use the existing limit/offset envelope. Writes atomically enqueue a durable
assessment job and return assessmentJobId. The worker evaluates asynchronously;
the record remains saved if evaluation fails and retries are tracked by the job.
Raw record ingestion is an
operator workflow in this iteration, not authenticated hardware telemetry.

## Automatic checks and warning lifecycle

The separate BullMQ worker schedules per-profile checks every 60 seconds.
HEALTH_SWEEP_ENABLED=false disables scheduled scans. HEALTH_SWEEP_INTERVAL_SECONDS
supports 10–86400. Reads still compute freshness when the worker is disabled.
Scans enqueue profiles in batches of 50; each profile job retries independently.
PostgreSQL advisory transaction locks serialize each
crew's snapshot reconciliation and reference/record writes across API instances.

ZoneState stores the last reconciled result and evaluation time. A semantic change
creates HEALTH_STATE_CHANGED, recording old/new evidence and record/reference IDs.
Identical rechecks update evaluatedAt without creating duplicate change events.
The worker also refreshes HealthRecord.isOutdated cache flags.

Missing/stale records create DATA_FRESHNESS warnings (OUTDATED). Threshold breaches
create HEALTH_RISK warnings (ATTENTION/CRITICAL). These alerts have an explicit zone.
HOSTILE_ENVIRONMENT is used as an operational catalogue bucket for generated
warnings, not a claim about the physiological cause. Existing operator alerts are
not assigned zones automatically or auto-resolved by this worker.
Generated health/freshness alerts are excluded from the mission's NASA hazard
aggregation so reference deviations cannot masquerade as environmental measurements.

Deduplication keys identify crew + zone + warning kind + measurement ID; risk keys
also include baseline version. Acknowledging an episode does not change risk or
freshness and does not reopen that exact episode every minute. New evidence or a
new reference can create a new risk episode. Superseded/cleared automatic warnings
are resolved, retaining their original rows and recording an audit event. Operator
warnings are untouched. A missing-data acknowledgement suppresses the same missing
episode until a measurement becomes available; dataState remains visibly MISSING.

## Journal

Append-only through the API: BASELINE_SET, HEALTH_RECORD_CREATED,
DAILY_CHECK_CREATED, HEALTH_STATE_CHANGED, ALERT_GENERATED, ALERT_AUTO_RESOLVED,
ALERT_RESOLVED, USER_CREATED and AUTH_LOGOUT. Mutations and their events are written
in the same DB transaction. Operator IDs/usernames and timestamps identify actions;
background events have actorId=null. Telemetry/task lifecycle events are described
in telemetry_jobs.md. Passwords and access tokens are never logged.
The journal contains medical evidence and uses the same profile access restrictions.
This is an application audit trail, not a cryptographically tamper-proof archive;
DB administrators retain access, and mission deletion cascades related records.

## Frontend

Crew roster/profile now exposes all five zones, independent risk/data labels,
comparison evidence, profile warnings and acknowledgement notes, pageable history,
reference versions and the journal. Operators can enter measurements and reference
rules; Crew Members have read-only access to their own profile here. Profile data
refreshes every 15 seconds and after writes, with loading/error/retry states.
