# Frontend workspace

Next.js App Router provides eight authenticated views. `/` redirects to
`/mission-control`. The `(workspace)` route group shares a persistent shell;
client navigation preserves the in-memory session.

| Route | Purpose |
| --- | --- |
| `/mission-control` | Mission summary, environment, hazards and active warnings |
| `/crew` | Searchable accessible roster and pagination |
| `/crew/[id]` | Five-zone risk/freshness, evidence, history, baselines and audit |
| `/daily-check` | Manual report with review, idempotent submission and receipt |
| `/alerts` | Filtered warnings, details and operator acknowledgement |
| `/simulator` | Queued hypothetical baseline projection and evidence |
| `/protocols` | Hazard-filtered protocol library and instructions |
| `/settings` | Session, permissions and Commander account provisioning |

## Boundaries

- `components/auth`: session and login. JWT lives only in memory; reload requires
  login. Expiry/401 and logout clear authenticated UI. The API remains the access
  authority; hiding a control does not replace server guards.
- `components/shell`: mission context, navigation, breadcrumbs, mission header,
  notification center and responsive drawer. Mission/active warnings refresh
  every 15 seconds. Roster requests paginate through the accessible API scope.
- `components/pages`: feature forms, tables and page orchestration.
- `components/crew`: existing health profile and medical operator editors.
- `components/ui`: buttons, badges, metric cards, table/pagination, loading,
  error/empty states, native dialog and session-scoped notifications.
- `hooks/use-api-resource`: abortable typed requests, query-key reset, retry and
  optional polling. Job polling stops at terminal states.
- `services/api`: shared Axios client with relative proxy URL, bearer injection
  and normalized JSON/network/proxy errors. Shared contracts come from
  `packages/shared-types`; no token is persisted in browser storage.

Commander and Medical Officer can inspect the assigned mission's profiles and
operate medical workflows. Crew Members see their own scope and cannot run
projections, acknowledge warnings or provision accounts. Only Commander sees the
account form. Review dialogs do not echo account passwords.

Daily reports and simulations retain an idempotency key for identical retries.
Risk and data freshness are independent labels. Acknowledgement does not change
health risk. Simulator currently exposes BASELINE_PROJECTION only; solar-storm
and gravity models require subsequent backend work. No synthetic medical limits
are supplied by the interface. Notifications are transient session activity, not
a durable notification inbox. Delay is mission metadata, not a live network probe.

## Accessibility and presentation

Responsive local CSS supports desktop sidebar and mobile drawer without external
fonts/assets. Tables scroll inside their own container. Controls have labels,
keyboard focus, validation and status feedback. Native dialogs support Escape,
focus restoration and modal focus containment. Reduced-motion preferences apply.

## Verification

`npm run web:build` checks the production routes. `npm run test:web` runs the
Playwright journey against a running stack and a disposable synthetic fixture.
It covers all routes, daily submission, warning review, protocols, JSON/HTML API
failures and recovery, projection completion, account creation, mobile navigation,
Crew access restrictions and reload/logout privacy. GitHub startup CI runs this
against Docker alongside backend/queue tests and restart checks.

Fixture setup must target a disposable seeded database. It generates unique
synthetic users/profile/reference/warning, writes credentials only to ignored
`.test-data/web-fixture.json`, and cleanup removes these scoped records. Do not
commit this file or use production data for the test.
