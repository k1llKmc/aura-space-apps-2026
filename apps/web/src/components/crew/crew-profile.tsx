'use client';
import { useEffect, useState, type FormEvent } from 'react';
import type {
  AlertResponse,
  AuditEventResponse,
  AuthUser,
  BaselineResponse,
  CrewHealthResponse,
  HealthRecordResponse,
  ListResponse,
} from '@aura/shared-types';
import { apiClient } from '@/services/api/client';
import { HealthEditors } from './health-editors';
import { BodyMap } from './body-map';
import { AlertCard, ZoneStatusCard } from '@/components/ui/aura';
import { CrewHero } from '@/components/experience/progress';
import { HealthTrends } from '@/components/experience/analytics';
import { ReadableData, MissionJournal } from '@/components/experience/journal';
import { friendly } from '@/components/experience/format';
import { DEMO_MODE } from '@/demo/config';
const zoneLabels: Record<string, string> = {
  HEAD_EYES: 'Head & eyes',
  CHEST_CARDIO: 'Chest & cardiovascular',
  ABDOMEN_METABOLISM: 'Abdomen & metabolism',
  WHOLE_BODY_IMMUNE: 'Whole body & immune',
  SKELETON_MUSCLES: 'Skeleton & muscles',
};
export function CrewProfile({ id, actor }: { id: string; actor: AuthUser }) {
  const [selectedZone, setSelectedZone] = useState('HEAD_EYES');
  const [profile, setProfile] = useState<CrewHealthResponse>();
  const [records, setRecords] = useState<ListResponse<HealthRecordResponse>>();
  const [audit, setAudit] = useState<ListResponse<AuditEventResponse>>();
  const [baselines, setBaselines] = useState<ListResponse<BaselineResponse>>();
  const [alerts, setAlerts] = useState<ListResponse<AlertResponse>>();
  const [offset, setOffset] = useState(0),
    [auditOffset, setAuditOffset] = useState(0),
    [baselineOffset, setBaselineOffset] = useState(0),
    [alertOffset, setAlertOffset] = useState(0);
  const [revision, setRevision] = useState(0),
    [error, setError] = useState('');
  const operator = actor.role !== 'CREW_MEMBER';
  const refresh = () => setRevision((value) => value + 1);
  useEffect(() => {
    const timer = setInterval(() => setRevision((value) => value + 1), 15000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    let active = true;
    Promise.all([
      apiClient.get<CrewHealthResponse>(`/crew/${id}/health`),
      apiClient.get<ListResponse<HealthRecordResponse>>(
        `/crew/${id}/records?limit=10&offset=${offset}`,
      ),
      apiClient.get<ListResponse<AuditEventResponse>>(
        `/audit?crewMemberId=${id}&limit=10&offset=${auditOffset}`,
      ),
      apiClient.get<ListResponse<BaselineResponse>>(
        `/crew/${id}/baselines?limit=10&offset=${baselineOffset}`,
      ),
      apiClient.get<ListResponse<AlertResponse>>(
        `/alerts?crewMemberId=${id}&isResolved=false&limit=10&offset=${alertOffset}`,
      ),
    ])
      .then(([health, history, events, references, warnings]) => {
        if (!active) return;
        setProfile(health.data);
        setRecords(history.data);
        setAudit(events.data);
        setBaselines(references.data);
        setAlerts(warnings.data);
        setError('');
      })
      .catch((reason) => {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : 'Unable to load crew health.',
          );
      });
    return () => {
      active = false;
    };
  }, [id, offset, auditOffset, baselineOffset, alertOffset, revision]);
  return (
    <div className="space-y-6">
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-900 p-3 text-red-300"
        >
          {error}{' '}
          <button onClick={refresh} className="underline">
            Retry
          </button>
        </p>
      )}
      {!profile && !error && (
        <p className="text-slate-300">Loading health profile…</p>
      )}
      {profile && (
        <>
          {DEMO_MODE && (
            <>
              <CrewHero id={id} />
              <HealthTrends id={id} />
            </>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-xl text-white">
              {DEMO_MODE ? 'Clinical overview' : profile.name}
            </h3>
            <button
              onClick={refresh}
              className="rounded border border-slate-600 px-3 py-2 text-slate-200"
            >
              Refresh health
            </button>
          </div>
          <p className="text-sm text-slate-400">
            Evaluated {new Date(profile.evaluatedAt).toLocaleString()}. Risk
            compares measurements with configured reference rules. Measurement
            freshness is shown separately.
          </p>
          {profile.hasOutdatedData && (
            <p className="text-amber-300">
              Some zones need updated measurements.
            </p>
          )}
          <div className="health-zone-layout">
            <BodyMap
              zones={profile.zones}
              selected={selectedZone}
              onSelect={setSelectedZone}
            />
            <div className="zone-card-grid">
              {profile.zones
                .filter((zone) => !DEMO_MODE || zone.zone === selectedZone)
                .map((zone) => (
                  <ZoneStatusCard
                    key={zone.zone}
                    zone={zone}
                    selected={selectedZone === zone.zone}
                  >
                    <p className="text-sm text-slate-300">{zone.message}</p>
                    <p className="text-xs text-slate-400">
                      {zone.lastChecked
                        ? new Date(zone.lastChecked).toLocaleString()
                        : 'No measurement'}{' '}
                      · {zone.sourceType?.replaceAll('_', ' ') || 'No source'}
                    </p>
                    {zone.evidence.map((item) => (
                      <div
                        key={item.metric}
                        className="rounded bg-slate-800 p-3 text-sm text-slate-200"
                      >
                        <p>
                          {friendly(item.metric)}:{' '}
                          {item.current ?? 'Unavailable'} {item.unit} ·
                          reference {item.baseline}
                        </p>
                        <p className="mt-1 text-slate-400">{item.reason}</p>
                      </div>
                    ))}
                    {zone.baselineId && (
                      <details className="text-xs text-slate-400">
                        <summary>Assessment reference</summary>
                        <p className="break-all">
                          Individual reference ·{' '}
                          {zone.assessmentComplete
                            ? 'Complete comparison'
                            : 'Incomplete comparison'}
                        </p>
                      </details>
                    )}
                  </ZoneStatusCard>
                ))}
            </div>
          </div>
        </>
      )}
      {alerts && (
        <section className="space-y-3">
          <h3 className="text-xl text-white">Profile warnings</h3>
          {alerts.items.length === 0 && (
            <p className="text-slate-400">No active profile warnings.</p>
          )}
          {alerts.items.map((alert) => (
            <AlertCard key={alert.id} alert={alert}>
              {operator && <ResolveAlert id={alert.id} refresh={refresh} />}
            </AlertCard>
          ))}
          <Pager
            offset={alertOffset}
            total={alerts.total}
            change={setAlertOffset}
            label="warnings"
          />
        </section>
      )}
      {operator && <HealthEditors id={id} refresh={refresh} />}
      {records && (
        <details className="panel section-panel space-y-3" open={!DEMO_MODE}>
          <summary className="text-lg">
            Measurement history · {records.total} entries
          </summary>
          {records.items.length === 0 && (
            <p className="text-slate-400">No medical records yet.</p>
          )}
          {records.items.map((record) => (
            <details
              key={record.id}
              className="rounded-lg border border-slate-700 p-4 text-slate-300"
            >
              <summary>
                {new Date(record.recordedAt).toLocaleString()} ·{' '}
                {record.zone ? zoneLabels[record.zone] : 'Daily self-report'} ·{' '}
                {record.sourceType.replaceAll('_', ' ')} ·{' '}
                {record.isOutdated ? 'STALE' : 'CURRENT'}
              </summary>
              <div className="mt-3">
                <ReadableData value={record.metrics} />
                {record.symptoms.length > 0 && (
                  <p>Symptoms: {record.symptoms.join(', ')}</p>
                )}
              </div>
            </details>
          ))}
          <Pager
            offset={offset}
            total={records.total}
            change={setOffset}
            label="records"
          />
        </details>
      )}
      {baselines && (
        <details className="panel section-panel space-y-3" open={!DEMO_MODE}>
          <summary className="text-lg">
            Reference policies · {baselines.total} versions
          </summary>
          {baselines.items.length === 0 && (
            <p className="text-slate-400">No baseline rules configured.</p>
          )}
          {baselines.items.map((baseline) => (
            <details
              key={baseline.id}
              className="rounded-lg border border-slate-700 p-4 text-slate-300"
            >
              <summary>
                {zoneLabels[baseline.zone]} ·{' '}
                {new Date(baseline.createdAt).toLocaleString()}
              </summary>
              <div className="mt-3">
                <ReadableData value={baseline.baselineData} />
              </div>
            </details>
          ))}
          <Pager
            offset={baselineOffset}
            total={baselines.total}
            change={setBaselineOffset}
            label="references"
          />
        </details>
      )}
      {DEMO_MODE && <MissionJournal crewId={id} />}
      {!DEMO_MODE && audit && (
        <section className="space-y-3">
          <h3 className="text-xl text-white">Activity & changes</h3>
          {audit.items.length === 0 && (
            <p className="text-slate-400">No activity recorded yet.</p>
          )}
          {audit.items.map((event) => (
            <details
              key={event.id}
              className="rounded-lg border border-slate-700 p-4 text-sm text-slate-300"
            >
              <summary>
                {new Date(event.createdAt).toLocaleString()} ·{' '}
                {event.action.replaceAll('_', ' ')} ·{' '}
                {event.actorUsername ||
                  (event.actorId ? 'Operator' : 'Automatic check')}
              </summary>
              <div className="mt-3">
                <ReadableData value={event.details} />
              </div>
            </details>
          ))}
          <Pager
            offset={auditOffset}
            total={audit.total}
            change={setAuditOffset}
            label="events"
          />
        </section>
      )}
    </div>
  );
}
function Pager({
  offset,
  total,
  change,
  label,
}: {
  offset: number;
  total: number;
  change: (value: number) => void;
  label: string;
}) {
  if (total <= 10) return null;
  return (
    <div className="flex items-center gap-4 text-sm text-slate-300">
      <button
        disabled={offset === 0}
        onClick={() => change(Math.max(0, offset - 10))}
        className="disabled:opacity-40"
      >
        Previous {label}
      </button>
      <span>
        {offset + 1}–{Math.min(offset + 10, total)} / {total}
      </span>
      <button
        disabled={offset + 10 >= total}
        onClick={() => change(offset + 10)}
        className="disabled:opacity-40"
      >
        Next {label}
      </button>
    </div>
  );
}
function ResolveAlert({ id, refresh }: { id: string; refresh: () => void }) {
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const note = new FormData(event.currentTarget).get('note');
    try {
      await apiClient.patch(`/alerts/${id}/resolve`, { note });
      refresh();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Unable to acknowledge warning.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="mt-3 space-y-2">
      <label className="block text-sm text-slate-300">
        Review note
        <input
          name="note"
          required
          maxLength={2000}
          className="mt-1 block w-full rounded bg-slate-800 p-2 text-white"
        />
      </label>
      <button
        disabled={busy}
        className="text-sm text-cyan-300 disabled:opacity-50"
      >
        {busy ? 'Saving…' : 'Acknowledge warning'}
      </button>
      <p className="text-xs text-slate-400">
        Acknowledgement does not change measured risk or data freshness.
      </p>
      {error && (
        <p role="alert" className="text-red-300">
          {error}
        </p>
      )}
    </form>
  );
}
