'use client';
import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  BodyZone,
  DataSourceType,
  zoneMetricCatalog,
  type AsyncTaskResponse,
  type HealthZoneStatus,
} from '@aura/shared-types';
import { useSession } from '@/components/auth/session-provider';
import { useApiResource } from '@/hooks/use-api-resource';
import { useNotifications } from '@/components/ui/notifications';
import {
  AccessNotice,
  Badge,
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from '@/components/ui/ui';
import { apiClient } from '@/services/api/client';
import { CrewSelect, useCrewSelection } from './crew-selection';
import { friendly } from '@/components/experience/format';
type ProjectionResult = Pick<
  HealthZoneStatus,
  'riskStatus' | 'assessmentComplete' | 'evidence'
> & {
  mode: string;
  explanation: string;
  baselineId: string;
  modelVersion: string;
};
export function SimulatorPage() {
  const { user } = useSession();
  const { roster, selected, setSelected } = useCrewSelection();
  const [zone, setZone] = useState<BodyZone>('HEAD_EYES');
  const [jobId, setJobId] = useState<string | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const request = useRef<{ fingerprint: string; key: string } | null>(null);
  const notified = useRef<string | null>(null);
  const job = useApiResource<AsyncTaskResponse>(
    jobId ? `/jobs/${jobId}` : null,
    1500,
    (task) => ['COMPLETED', 'FAILED'].includes(task.state),
  );
  const currentJob = job.data?.jobId === jobId ? job.data : undefined;
  const { notify } = useNotifications();
  useEffect(() => {
    if (!job.data || !['COMPLETED', 'FAILED'].includes(job.data.state)) return;
    const fingerprint = `${job.data.jobId}/${job.data.generation}/${job.data.state}`;
    if (fingerprint === notified.current) return;
    notified.current = fingerprint;
    notify(
      job.data.state === 'COMPLETED'
        ? 'Baseline projection completed.'
        : 'Simulation could not be completed.',
      job.data.state === 'COMPLETED' ? 'success' : 'error',
    );
  }, [job.data, notify]);
  const running =
    !!jobId &&
    (!currentJob || ['PENDING', 'PROCESSING'].includes(currentJob.state));
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const fields = new FormData(event.currentTarget),
      metrics: Record<string, number> = {},
      units: Record<string, string> = {};
    for (const [key, unit] of Object.entries(zoneMetricCatalog[zone])) {
      const value = fields.get(key);
      if (typeof value === 'string' && value !== '') {
        metrics[key] = Number(value);
        units[key] = unit;
      }
    }
    if (!Object.keys(metrics).length) {
      setError('Enter at least one hypothetical metric.');
      setBusy(false);
      return;
    }
    const payload = {
      scenarioType: 'BASELINE_PROJECTION',
      crewMemberId: selected,
      projection: {
        zone,
        sourceType: fields.get('sourceType'),
        metrics,
        units,
        symptoms: [],
      },
    };
    const fingerprint = JSON.stringify(payload);
    if (request.current?.fingerprint !== fingerprint)
      request.current = { fingerprint, key: crypto.randomUUID() };
    try {
      const { data } = await apiClient.post<AsyncTaskResponse>(
        '/simulator/run',
        payload,
        { headers: { 'Idempotency-Key': request.current!.key } },
      );
      setJobId(data.jobId);
      notify('Simulation submitted. You can follow its status below.', 'info');
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Unable to submit simulation.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function retry() {
    if (!jobId) return;
    setBusy(true);
    setError('');
    try {
      await apiClient.post(`/jobs/${jobId}/retry`);
      job.refresh();
      notify('Simulation retry queued.', 'info');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to retry.');
    } finally {
      setBusy(false);
    }
  }
  const result =
    currentJob?.state === 'COMPLETED'
      ? (currentJob.result as ProjectionResult)
      : undefined;
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Resources / What-if workspace"
        title="Mission Risk Simulator"
        description="Compare hypothetical measurements with a captured baseline version, without changing clinical records."
      />
      <div className="panel section-panel">
        <Badge value="CURRENT" label="Available model: Baseline projection" />
        <p className="muted mt-3">
          Solar-storm, gravity and isolation scenario models are not available
          yet. This workspace runs the existing baseline comparison model only.
        </p>
      </div>
      {user?.role === 'CREW_MEMBER' ? (
        <AccessNotice>
          Simulation runs require Commander or Medical Officer access.{' '}
          <Link className="text-link" href="/crew">
            Review your health profile →
          </Link>
        </AccessNotice>
      ) : (
        <>
          {roster.error && (
            <ErrorState message={roster.error} retry={roster.refresh} />
          )}
          {!roster.data && roster.loading && (
            <LoadingState label="Loading crew…" />
          )}
          {roster.data?.length === 0 && (
            <EmptyState
              title="No accessible crew"
              description="A crew profile and versioned reference policy are required to run a projection."
            />
          )}
          {!!roster.data?.length && (
            <form onSubmit={submit} className="panel section-panel space-y-5">
              <fieldset disabled={busy || running} className="space-y-5">
                <div className="form-grid">
                  <CrewSelect
                    rows={roster.data}
                    value={selected}
                    onChange={setSelected}
                  />
                  <label>
                    Body zone
                    <select
                      aria-label="Body zone"
                      value={zone}
                      onChange={(event) =>
                        setZone(event.target.value as BodyZone)
                      }
                    >
                      {Object.values(BodyZone).map((value) => (
                        <option key={value} value={value}>
                          {friendly(value)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Assumed source
                    <select name="sourceType" aria-label="Assumed source">
                      {Object.values(DataSourceType).map((source) => (
                        <option key={source} value={source}>
                          {friendly(source)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="form-grid" key={`${selected}/${zone}`}>
                  {Object.entries(zoneMetricCatalog[zone]).map(
                    ([key, unit]) => (
                      <label key={key}>
                        {friendly(key)} ({unit})
                        <input type="number" step="any" name={key} />
                      </label>
                    ),
                  )}
                </div>
                <p className="muted text-sm">
                  Enter the metrics covered by the selected zone’s reference
                  policy. Missing metrics make the comparison incomplete.
                </p>
                <Button type="submit" variant="primary" disabled={!selected}>
                  {busy
                    ? 'Submitting…'
                    : running
                      ? 'Simulation running…'
                      : 'Run baseline projection'}
                </Button>
              </fieldset>
              {selected && (
                <Link className="text-link text-sm" href={`/crew/${selected}`}>
                  Review this crew member’s reference rules →
                </Link>
              )}
            </form>
          )}
          {error && <ErrorState message={error} />}
          {jobId && (
            <section className="panel section-panel space-y-5">
              <div className="section-heading">
                <h2>Simulation result</h2>
                <Badge value={job.data?.state || 'PENDING'} />
              </div>
              {job.error && (
                <ErrorState message={job.error} retry={job.refresh} />
              )}
              {running && (
                <LoadingState label="Waiting for the background worker…" />
              )}
              {job.data?.state === 'FAILED' && (
                <div className="space-y-3">
                  <p className="text-red-300">
                    The run failed ({job.data.errorCode}). Measurements and crew
                    state were not changed.
                  </p>
                  <Button onClick={retry} disabled={busy}>
                    Retry simulation
                  </Button>
                </div>
              )}
              {result && (
                <>
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge value={result.riskStatus} />
                    <span className="muted text-sm">
                      {result.assessmentComplete
                        ? 'All configured metrics assessed'
                        : 'Incomplete comparison'}
                    </span>
                  </div>
                  <p className="muted">{result.explanation}</p>
                  {result.evidence.length > 0 && (
                    <DataTable
                      caption="Hypothetical metric comparison"
                      rows={result.evidence.map((item) => ({
                        ...item,
                        id: item.metric,
                      }))}
                      columns={[
                        {
                          key: 'metric',
                          label: 'Metric',
                          render: (item) =>
                            `${friendly(item.metric)} (${item.unit})`,
                        },
                        {
                          key: 'current',
                          label: 'Hypothetical value',
                          render: (item) => item.current ?? 'Unavailable',
                        },
                        {
                          key: 'baseline',
                          label: 'Reference',
                          render: (item) => item.baseline,
                        },
                        {
                          key: 'risk',
                          label: 'Comparison',
                          render: (item) => <Badge value={item.riskStatus} />,
                        },
                        {
                          key: 'why',
                          label: 'Explanation',
                          render: (item) => item.reason,
                        },
                      ]}
                    />
                  )}
                  <details className="muted text-xs">
                    <summary>Run reference</summary>
                    <p className="mt-2 break-all">
                      Individual reference comparison · Synthetic projection
                    </p>
                  </details>
                  <Button
                    onClick={() => {
                      setJobId(null);
                      request.current = null;
                    }}
                  >
                    Start another run
                  </Button>
                </>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
