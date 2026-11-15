import {
  AxiosError,
  type AxiosAdapter,
  type InternalAxiosRequestConfig,
} from 'axios';
import {
  BodyZone,
  HazardType,
  aggregateStatus,
  zoneMetricCatalog,
  type AlertResponse,
  type AsyncTaskResponse,
  type AuditEventResponse,
  type BaselineResponse,
  type BaselineRule,
  type CrewHealthResponse,
  type HealthRecordResponse,
  type MetricEvidence,
  type RiskStatus,
} from '@aura/shared-types';
import { DEMO_STORAGE, demoCrewIds, demoUser } from './config';
const now = () => new Date().toISOString();
const ago = (days: number) =>
  new Date(Date.now() - days * 86400000).toISOString();
const uuid = () => crypto.randomUUID();
export const demoCrew = demoCrewIds.map((id, i) => ({
  id,
  name: [
    'Elena Vasquez',
    'Marcus Chen',
    'Amara Okafor',
    'Luca Moretti',
    'Sofia Andersson',
    'Noah Patel',
  ][i],
  role: [
    'Mission Commander',
    'Flight Engineer',
    'Medical Officer',
    'Research Specialist',
    'Systems Engineer',
    'Pilot',
  ][i],
  photoUrl: null,
}));
type Store = {
  baselines: Record<string, BaselineResponse[]>;
  records: Record<string, (HealthRecordResponse & { crewMemberId?: string })[]>;
  alerts: AlertResponse[];
  audit: AuditEventResponse[];
  jobs: Record<string, AsyncTaskResponse>;
  checks: Record<string, unknown>;
  receipts: Record<string, unknown>;
};
const baseValues: Record<BodyZone, number[]> = {
  HEAD_EYES: [15, 260, 1],
  CHEST_CARDIO: [62, 118, 78],
  ABDOMEN_METABOLISM: [4.8, 72],
  WHOLE_BODY_IMMUNE: [6, 1],
  SKELETON_MUSCLES: [32, 1.2, -0.2],
};
function seed(): Store {
  const store: Store = {
    baselines: {},
    records: {},
    alerts: [],
    audit: [],
    jobs: {},
    checks: {},
    receipts: {},
  };
  demoCrew.forEach((crew, i) => {
    store.baselines[crew.id] = [];
    store.records[crew.id] = [];
    Object.values(BodyZone).forEach((zone, z) => {
      const entries = Object.entries(zoneMetricCatalog[zone]);
      const rules: BaselineRule[] = entries.map(([metric, unit], j) => ({
        metric,
        unit,
        baseline: baseValues[zone][j],
        comparison: 'ABSOLUTE',
        direction: 'BOTH',
        attentionDelta: Math.max(Math.abs(baseValues[zone][j]) * 0.1, 0.2),
        criticalDelta: Math.max(Math.abs(baseValues[zone][j]) * 0.2, 0.4),
        allowedSources: [
          'AUTO_TELEMETRY',
          'MANUAL_REPORT',
          'DIAGNOSTIC_DEVICE',
        ],
      }));
      store.baselines[crew.id].push({
        id: `reference-${i}-${z}`,
        zone,
        createdAt: ago(30),
        baselineData: { schemaVersion: 1, rules },
      });
      if (i === 4 && z === 3) return;
      const metrics = Object.fromEntries(
        rules.map((r, j) => [
          r.metric,
          Number(
            (
              r.baseline +
              (i === 1 && z === 0 && j === 0
                ? r.attentionDelta * 1.4
                : i === 3 && z === 4 && j === 0
                  ? r.criticalDelta * 1.2
                  : 0)
            ).toFixed(2),
          ),
        ]),
      );
      store.records[crew.id].push({
        id: `measurement-${i}-${z}`,
        crewMemberId: crew.id,
        zone,
        sourceType: z % 2 ? 'AUTO_TELEMETRY' : 'DIAGNOSTIC_DEVICE',
        metrics,
        units: Object.fromEntries(entries),
        symptoms: [],
        recordedAt: ago(i === 2 && z === 2 ? 9 : 0.02),
        isOutdated: i === 2 && z === 2,
      });
    });
  });
  store.alerts = [
    {
      id: 'warning-1',
      crewMemberId: demoCrewIds[3],
      zone: 'SKELETON_MUSCLES',
      severity: 'CRITICAL',
      title: 'Musculoskeletal deviation detected',
      message:
        'Luca’s synthetic muscle-mass measurement exceeds the configured demonstration reference. Review the evidence and countermeasure plan.',
      hazardType: 'ALTERED_GRAVITY',
    },
    {
      id: 'warning-2',
      crewMemberId: demoCrewIds[1],
      zone: 'HEAD_EYES',
      severity: 'ATTENTION',
      title: 'Vision assessment requires review',
      message:
        'Marcus’s demonstration measurement differs from his individual reference. Schedule a follow-up diagnostic check.',
      hazardType: 'ALTERED_GRAVITY',
    },
    {
      id: 'warning-3',
      crewMemberId: demoCrewIds[2],
      zone: 'ABDOMEN_METABOLISM',
      severity: 'OUTDATED',
      title: 'Metabolic assessment is stale',
      message:
        'The latest metabolic measurement is more than seven days old. Collect updated data before interpreting the current state.',
      hazardType: 'HOSTILE_ENVIRONMENT',
    },
    {
      id: 'warning-4',
      crewMemberId: null,
      zone: null,
      severity: 'ATTENTION',
      title: 'Crew recovery window',
      message:
        'Review rest schedules during the current cruise segment and complete today’s self-report.',
      hazardType: 'ISOLATION_CONFINEMENT',
    },
  ].map((a, i) => ({
    ...a,
    missionId: demoUser.missionId,
    isResolved: false,
    createdAt: ago(0.02 + i * 0.01),
    resolvedAt: null,
    resolvedById: null,
    resolutionNote: null,
    origin: 'SYNTHETIC_DEMO',
  })) as AlertResponse[];
  return store;
}
let memory: Store | undefined;
function state() {
  if (!memory) {
    try {
      const saved = localStorage.getItem(DEMO_STORAGE);
      memory = saved ? JSON.parse(saved) : seed();
    } catch {
      memory = seed();
    }
  }
  return memory!;
}
function save(s: Store) {
  try {
    localStorage.setItem(DEMO_STORAGE, JSON.stringify(s));
  } catch {
    /* Memory remains usable when storage is unavailable. */
  }
}
function evidence(
  rules: BaselineRule[],
  metrics: Record<string, number>,
  source: string,
  units: Record<string, string>,
): MetricEvidence[] {
  return rules.map((rule) => {
    const value = metrics[rule.metric];
    const compatible =
      Number.isFinite(value) &&
      rule.allowedSources.includes(source as never) &&
      units[rule.metric] === rule.unit;
    const delta = compatible
      ? rule.comparison === 'PERCENT'
        ? rule.baseline === 0
          ? null
          : ((value - rule.baseline) / Math.abs(rule.baseline)) * 100
        : value - rule.baseline
      : null;
    const deviation =
      delta === null
        ? null
        : rule.direction === 'BOTH'
          ? Math.abs(delta)
          : rule.direction === 'INCREASE'
            ? delta
            : -delta;
    const riskStatus: RiskStatus | null =
      deviation === null
        ? null
        : deviation >= rule.criticalDelta
          ? 'CRITICAL'
          : deviation >= rule.attentionDelta
            ? 'ATTENTION'
            : 'NOMINAL';
    return {
      metric: rule.metric,
      unit: rule.unit,
      baseline: rule.baseline,
      current: compatible ? value : null,
      delta,
      comparison: rule.comparison,
      riskStatus,
      reason: riskStatus
        ? `Synthetic reference comparison: ${riskStatus.toLowerCase()}.`
        : 'A compatible measurement and non-zero reference for percentage comparison are required.',
    };
  });
}
function health(s: Store, id: string): CrewHealthResponse {
  const crew = demoCrew.find((c) => c.id === id);
  if (!crew) throw new Error('Crew profile not found.');
  const zones = Object.values(BodyZone).map((zone) => {
    const record = s.records[id].find((r) => r.zone === zone),
      baseline = s.baselines[id].find((b) => b.zone === zone);
    const items = evidence(
      (baseline?.baselineData as { rules: BaselineRule[] })?.rules || [],
      (record?.metrics as Record<string, number>) || {},
      record?.sourceType || '',
      (record?.units as Record<string, string>) || {},
    );
    const known = items.filter((e) => e.riskStatus !== null);
    const riskStatus = known.length
      ? (aggregateStatus(known.map((e) => e.riskStatus!)) as RiskStatus)
      : null;
    const stale =
      !!record && Date.now() - Date.parse(record.recordedAt) > 7 * 86400000;
    const dataState = !record
      ? ('MISSING' as const)
      : stale
        ? ('STALE' as const)
        : ('CURRENT' as const);
    return {
      zone,
      status:
        riskStatus === 'CRITICAL' || riskStatus === 'ATTENTION'
          ? riskStatus
          : dataState !== 'CURRENT'
            ? ('OUTDATED' as const)
            : ('NOMINAL' as const),
      riskStatus,
      dataState,
      lastChecked: record?.recordedAt || null,
      isOutdated: dataState !== 'CURRENT',
      sourceType: record?.sourceType || null,
      metrics: (record?.metrics as Record<string, unknown>) || null,
      message: !record
        ? 'No measurement available. Schedule a diagnostic check.'
        : stale
          ? 'Historical reference comparison; update this measurement before assessing current health.'
          : `Latest synthetic measurements: ${riskStatus?.toLowerCase() || 'not assessed'}.`,
      recordId: record?.id || null,
      baselineId: baseline?.id || null,
      assessmentComplete: !!items.length && known.length === items.length,
      evidence: items,
      rulesVersion: 'baseline-v1' as const,
    };
  });
  return {
    crewMemberId: id,
    name: crew.name,
    role: crew.role,
    evaluatedAt: now(),
    overallStatus: aggregateStatus(zones.map((z) => z.status)),
    hasOutdatedData: zones.some((z) => z.isOutdated),
    zones,
  };
}
const protocols = Object.values(HazardType).map((hazard, i) => ({
  id: `protocol-${i}`,
  hazard,
  title: [
    'Radiation shelter readiness',
    'Exercise & musculoskeletal support',
    'Crew wellbeing & recovery',
    'Autonomous care under communication delay',
    'Cabin environment response',
  ][i],
  description:
    'Demonstration workflow for mission planning. Follow approved mission procedures during real operations.',
  steps: [
    'Review the latest measurements, their source and data freshness.',
    'Confirm the finding with the responsible mission operator.',
    'Select the approved mission countermeasure and record your plan.',
    'Schedule a follow-up assessment and review the outcome.',
  ],
}));
function list<T>(items: T[], query: URLSearchParams) {
  const offset = Math.max(0, Number(query.get('offset') || 0)),
    limit = Math.min(100, Math.max(1, Number(query.get('limit') || 20)));
  return {
    items: items.slice(offset, offset + limit),
    total: items.length,
    limit,
    offset,
  };
}
export const demoAdapter: AxiosAdapter = async (config) => {
  if (config.signal?.aborted)
    throw new AxiosError('Request canceled', 'ERR_CANCELED', config);
  const url = new URL(config.url || '/', 'https://demo.invalid'),
    path = url.pathname,
    q = url.searchParams;
  const method = config.method?.toUpperCase() || 'GET';
  const body =
    typeof config.data === 'string'
      ? JSON.parse(config.data)
      : config.data || {};
  const s = state();
  let data: unknown;
  try {
    const receiptKey = config.headers.get('Idempotency-Key')?.toString();
    const mutationKey = receiptKey ? `${method}:${path}:${receiptKey}` : '';
    if (method !== 'GET' && mutationKey && s.receipts[mutationKey])
      data = s.receipts[mutationKey];
    else {
      if (path === '/auth/me') data = demoUser;
      else if (path === '/missions/current')
        data = {
          missionId: demoUser.missionId,
          name: 'ARES I · Mars Transit',
          destination: 'Mars',
          phase: 'Outbound cruise',
          missionDay: 142,
          commDelaySeconds: 840,
          commDelayFormatted: '14m 00s',
          environment: {
            radiationCans: 0.24,
            totalRadiation: 38.6,
            pO2: 21.2,
            co2Ppm: 780,
            cabinPressure: 101.3,
            temperature: 22.4,
            humidity: 43,
            status: 'NOMINAL',
            recordedAt: now(),
            sourceType: 'AUTO_TELEMETRY',
          },
          hazardsStatus: {
            spaceRadiation: 'NOMINAL',
            alteredGravity: 'ATTENTION',
            isolationConfinement: 'ATTENTION',
            distanceFromEarth: 'NOMINAL',
            hostileEnvironment: 'NOMINAL',
          },
        };
      else if (path === '/crew') data = list(demoCrew, q);
      else if (path === '/protocols')
        data = list(
          protocols.filter(
            (p) => !q.get('hazard') || p.hazard === q.get('hazard'),
          ),
          q,
        );
      else if (path.startsWith('/protocols/'))
        data = protocols.find((p) => p.id === path.split('/')[2]);
      else if (path === '/alerts')
        data = list(
          s.alerts.filter(
            (a) =>
              (!q.has('isResolved') ||
                a.isResolved === (q.get('isResolved') === 'true')) &&
              (!q.get('severity') || a.severity === q.get('severity')) &&
              (!q.get('crewMemberId') ||
                a.crewMemberId === q.get('crewMemberId')),
          ),
          q,
        );
      else if (/^\/alerts\/[^/]+\/resolve$/.test(path)) {
        const alert = s.alerts.find((a) => a.id === path.split('/')[2]);
        if (!alert) throw new Error('Warning not found.');
        if (!alert.isResolved) {
          alert.isResolved = true;
          alert.resolvedAt = now();
          alert.resolvedById = demoUser.id;
          alert.resolutionNote = body.note;
          s.audit.unshift({
            id: uuid(),
            actorId: demoUser.id,
            actorUsername: demoUser.username,
            crewMemberId: alert.crewMemberId,
            action: 'ALERT_RESOLVED',
            entityId: alert.id,
            details: { note: body.note },
            createdAt: now(),
          });
        }
        data = alert;
      } else if (path === '/audit')
        data = list(
          s.audit.filter(
            (a) =>
              !q.get('crewMemberId') ||
              a.crewMemberId === q.get('crewMemberId'),
          ),
          q,
        );
      else if (path === '/crew/checks') {
        const key = `${body.crewMemberId}:${now().slice(0, 10)}`;
        if (s.checks[key])
          throw new Error(
            'A daily report already exists for this crew member today.',
          );
        data = {
          success: true,
          checkId: uuid(),
          recordedAt: now(),
          checkDate: now().slice(0, 10),
          xpEarned: 50,
          currentStreak: 1,
          message: 'Daily report saved in this browser.',
        };
        s.checks[key] = data;
        s.records[body.crewMemberId].unshift({
          id: uuid(),
          crewMemberId: body.crewMemberId,
          zone: null,
          sourceType: 'MANUAL_REPORT',
          metrics: body,
          units: {},
          symptoms: body.symptoms,
          recordedAt: now(),
          isOutdated: false,
        });
      } else if (/^\/crew\/[^/]+\/(health|records|baselines)$/.test(path)) {
        const [, , id, resource] = path.split('/');
        if (!s.records[id]) throw new Error('Crew profile not found.');
        if (resource === 'health') data = health(s, id);
        else if (method === 'GET')
          data = list<HealthRecordResponse | BaselineResponse>(
            resource === 'records' ? s.records[id] : s.baselines[id],
            q,
          );
        else {
          const entry =
            resource === 'records'
              ? {
                  ...body,
                  id: uuid(),
                  crewMemberId: id,
                  recordedAt: body.recordedAt || now(),
                  isOutdated: false,
                }
              : {
                  id: uuid(),
                  zone: body.zone,
                  createdAt: now(),
                  baselineData: { schemaVersion: 1, rules: body.rules },
                };
          if (resource === 'records') s.records[id].unshift(entry);
          else s.baselines[id].unshift(entry);
          s.audit.unshift({
            id: uuid(),
            actorId: demoUser.id,
            actorUsername: demoUser.username,
            crewMemberId: id,
            action:
              resource === 'records'
                ? 'HEALTH_RECORD_CREATED'
                : 'BASELINE_CREATED',
            entityId: entry.id,
            details: { zone: body.zone },
            createdAt: now(),
          });
          data = entry;
        }
      } else if (path === '/simulator/run') {
        const baseline = s.baselines[body.crewMemberId]?.find(
          (b) => b.zone === body.projection.zone,
        );
        if (!baseline) throw new Error('No reference available.');
        const items = evidence(
          (baseline.baselineData as { rules: BaselineRule[] }).rules,
          body.projection.metrics,
          body.projection.sourceType,
          body.projection.units,
        );
        const task: AsyncTaskResponse = {
          jobId: uuid(),
          kind: 'SIMULATION',
          state: 'COMPLETED',
          attempts: 1,
          generation: 1,
          result: {
            mode: 'BASELINE_PROJECTION',
            explanation:
              'Hypothetical comparison against a synthetic individual reference. No clinical data was changed.',
            riskStatus: items.some((e) => e.riskStatus)
              ? aggregateStatus(
                  items.flatMap((e) => (e.riskStatus ? [e.riskStatus] : [])),
                )
              : null,
            assessmentComplete: items.every((e) => e.riskStatus !== null),
            evidence: items,
            baselineId: baseline.id,
            modelVersion: 'baseline-v1',
          },
          errorCode: null,
          createdAt: now(),
          updatedAt: now(),
          statusUrl: '',
        };
        task.statusUrl = `/api/v1/jobs/${task.jobId}`;
        s.jobs[task.jobId] = task;
        data = task;
      } else if (path.startsWith('/jobs/')) data = s.jobs[path.split('/')[2]];
      else throw new Error('This operation is unavailable in the public demo.');
      if (data === undefined)
        throw new Error('Requested demo resource was not found.');
      if (method !== 'GET') {
        if (mutationKey) s.receipts[mutationKey] = data;
        save(s);
      }
    }
    return {
      data: structuredClone(data),
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    };
  } catch (cause) {
    const message =
      cause instanceof Error
        ? cause.message
        : 'Unable to complete demo action.';
    throw new AxiosError(
      message,
      'DEMO_ERROR',
      config as InternalAxiosRequestConfig,
      undefined,
      {
        data: {
          statusCode: 400,
          error: 'Demo request',
          message: [message],
          timestamp: now(),
        },
        status: 400,
        statusText: 'Bad Request',
        headers: {},
        config,
      },
    );
  }
};
