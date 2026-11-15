# Backend contracts — authentication and access, revision 1

This document supersedes earlier notes that the crew API is unauthenticated.
Authoritative TypeScript contracts: `packages/shared-types/src/index.ts`.
All paths below are relative to `/api/v1`.

## Authentication

All business endpoints require `Authorization: Bearer <accessToken>`.
Only POST `/auth/login` and GET `/health` are public. No anonymous medical data,
registration, arbitrary mission selection, refresh tokens or cookie authentication.

POST `/auth/login`: strict `{ username, password }`; usernames are trimmed,
lowercased and match `[a-z0-9_.-]{3,64}`. Passwords are 12–128 characters, not
trimmed. Returns 200 `LoginResponse`, with a 900-second HS256 JWT (fixed issuer
`aura-api` and audience `aura-client`). Passwords use salted scrypt, never plaintext.
Bad credentials return generic 401. Twenty attempts per source IP per 15 minutes
are allowed, including invalid payloads and successful attempts; further attempts
return 429. This bounded in-memory limit is for the current single API instance.
Forwarded IP headers are not trusted. Via Next.js the limit is shared by requests
from that proxy. Multi-node deployments need a shared limiter before scaling.

GET `/auth/me`: returns the current public AuthUser (never passwordHash/tokenVersion).
POST `/auth/logout`: 200 `{ success: true }`, increments tokenVersion and revokes
all tokens for the account. Token signature/expiry, enabled state, version, current
role and mission/profile assignment are checked on every business request.

POST `/auth/users`: Commander only, strict `{ username, password, role,
crewMemberId? }`, returns 201 AuthUser. The new account belongs to the Commander's
mission. CREW_MEMBER requires a linked crew profile from that mission. All linked
profiles must belong to that mission. No client-supplied missionId or passwordHash.
Existing username returns 409. Job titles on CrewMember are separate from UserRole.

Initial Commander is provisioned once by `db:setup`/Compose bootstrap. The launcher
generates a random JWT_SECRET and AUTH_BOOTSTRAP_PASSWORD in ignored root `.env`.
Provisioning never resets passwords on restart. There is no public password reset
or user-management UI in this iteration; disabled/role/version changes in the DB
take effect at the next request. Mission membership for linked accounts is checked
again at authentication time.

## Permissions

| Operation | COMMANDER | MEDICAL_OFFICER | CREW_MEMBER |
| --- | --- | --- | --- |
| Mission status | Assigned mission | Assigned mission | Assigned mission |
| Crew list | Mission roster | Mission roster | Own profile only |
| Crew health / daily check | Mission crew | Mission crew | Own profile only |
| Alerts | Mission alerts | Mission alerts | Mission-wide + own alerts |
| Resolve alert | Mission alerts | Mission alerts | Forbidden |
| Protocol catalogue | Read | Read | Read |
| Create users | Own mission | Forbidden | Forbidden |

Crew/profile checks run before reading health data or replaying a daily check.
Forbidden crew access returns 403, including foreign-mission IDs. Alert lookup
outside the assigned mission returns 404. Resolving an alert does not imply a
medical assessment or mutate measurements. Mission status uses the authenticated
mission even when another mission is globally marked current.

## Lists and actions

GET `/crew`: `ListResponse<CrewSummary>` with public roster fields id/name/role/photoUrl.
No medical metrics, ages or account records are returned by this endpoint.

GET `/alerts`: `ListResponse<AlertResponse>`, optional `isResolved=true|false` and
`severity=NOMINAL|OUTDATED|ATTENTION|CRITICAL`. Default: both resolved/unresolved.
PATCH `/alerts/:id/resolve`: strict `{ note: string }`, trimmed 1–2000 characters.
200 returns AlertResponse including resolvedAt/resolvedById/resolutionNote. First
resolver wins atomically; retries retain the original audit fields, including note.
Resolved alerts stop contributing to risk aggregation on subsequent health reads.

GET `/protocols`: `ListResponse<ProtocolResponse>`, optional `hazard` enum filter.
GET `/protocols/:id`: ProtocolResponse or 404. Catalogue is shared across missions;
protocols contain reference information rather than crew-specific measurements.

All list endpoints accept offset (integer >=0, default 0), limit (integer 1–100,
default 20). Response: `{ items, total, offset, limit }`. Totals use the same scope
and filters as items. Unknown query fields are rejected with 400. Sorting has a
stable ID tie-breaker. Dates are ISO 8601 UTC. Invalid IDs/payloads return 400.

## Status and error compatibility

Shared statuses: NOMINAL, OUTDATED, ATTENTION, CRITICAL. Aggregation priority:
CRITICAL > ATTENTION > OUTDATED > NOMINAL. ELEVATED is not a supported API status.
Freshness CURRENT/STALE/MISSING remains separate from clinical risk; no diagnostic
thresholds are invented here. Mission environment status now aggregates radiation
and hostile-environment alerts. A nominal hazard status means no contributing
active alert; it is not a clinical clearance.

All errors use ApiErrorResponse: `{ statusCode, error, message: string[], timestamp }`.
401: missing/invalid/expired/revoked token. 403: insufficient role/profile permission.
404: missing scoped resource. 409: username or daily-check conflict. 429: login limit.
500: generic unexpected error; server details are logged, not sent to the client.
Responses from the running API are marked Cache-Control: no-store.

## Verification

Database-backed HTTP tests cover valid/invalid/expired JWTs, missing credentials,
all three roles, foreign-mission/profile access, permission checks before replay,
user creation restrictions, scoped lists, alert audit/repeat resolution, disabled
accounts, logout revocation and login limiting. Container CI runs these tests in
its isolated seeded database and checks readiness/proxy/unauthenticated rejection.
