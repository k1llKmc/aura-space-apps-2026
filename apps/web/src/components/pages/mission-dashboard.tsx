'use client';
import Link from 'next/link';
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  MetricCard,
  PageHeader,
} from '@/components/ui/ui';
import { useWorkspace } from '@/components/shell/workspace-provider';
import { TodaysMission } from '@/components/experience/progress';
import { CabinTrends } from '@/components/experience/analytics';
import { MissionJournal } from '@/components/experience/journal';
import { DEMO_MODE } from '@/demo/config';
const hazards = {
  spaceRadiation: 'Space radiation',
  alteredGravity: 'Altered gravity',
  isolationConfinement: 'Isolation & confinement',
  distanceFromEarth: 'Distance from Earth',
  hostileEnvironment: 'Hostile environment',
};
export function MissionDashboard() {
  const { mission, alerts, roster } = useWorkspace();
  const data = mission.data;
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Operations / Live overview"
        title="Mission Control"
        description="Your mission, environment and crew priorities in one view."
        actions={
          <Button onClick={mission.refresh} disabled={mission.loading}>
            Refresh telemetry
          </Button>
        }
      />
      {mission.error && (
        <ErrorState
          message={`${mission.error}${data ? ' Last received data remains visible below.' : ''}`}
          retry={mission.refresh}
        />
      )}
      {!data && mission.loading && (
        <LoadingState label="Loading mission telemetry…" />
      )}
      {data && (
        <>
          <section className="mission-hero panel">
            <div>
              <p className="eyebrow">
                {data.destination} · Mission day {data.missionDay}
              </p>
              <h2>{data.name}</h2>
              <p className="muted mt-2">{data.phase}</p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link className="button button-primary" href="/crew">
                  Open crew overview →
                </Link>
                <Link className="button button-secondary" href="/daily-check">
                  Daily health check
                </Link>
              </div>
            </div>
            <div className="mission-orbit" aria-hidden="true">
              <div />
              <span>AURA</span>
            </div>
          </section>
          <div className="metric-grid">
            <MetricCard
              label="Communication delay"
              value={data.commDelayFormatted}
              detail="Reported mission communication latency"
            />
            <MetricCard
              label="CANS radiation"
              value={
                <>
                  {data.environment.radiationCans}
                  <small> mSv/day</small>
                </>
              }
              detail={`Total dose: ${data.environment.totalRadiation} mSv`}
            />
            <MetricCard
              label="Active warnings"
              value={alerts.data?.total ?? '—'}
              detail={
                <Link className="text-link" href="/alerts">
                  Review mission warnings →
                </Link>
              }
            />
            <MetricCard
              label="Visible crew profiles"
              value={roster.data?.length ?? '—'}
              detail="Scoped to your account permissions"
            />
          </div>
          {DEMO_MODE && <TodaysMission />}
          {DEMO_MODE && <CabinTrends environment={data.environment} />}
          <section className="panel section-panel">
            <div className="section-heading">
              <h2>Five mission hazards</h2>
              <span className="muted text-xs">Reported by the mission API</span>
            </div>
            <div className="hazard-grid">
              {Object.entries(hazards).map(([key, label]) => (
                <article key={key}>
                  <p>{label}</p>
                  <Badge
                    value={data.hazardsStatus[key as keyof typeof hazards]}
                  />
                </article>
              ))}
            </div>
          </section>
          <section className="panel section-panel">
            <div className="section-heading">
              <h2>Cabin environment</h2>
              <Badge value={data.environment.status} />
            </div>
            <dl className="environment-grid">
              {[
                ['Oxygen partial pressure', `${data.environment.pO2} kPa`],
                ['Carbon dioxide', `${data.environment.co2Ppm} ppm`],
                ['Cabin pressure', `${data.environment.cabinPressure} kPa`],
                ['Temperature', `${data.environment.temperature} °C`],
                ['Humidity', `${data.environment.humidity}%`],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <p className="muted mt-5 text-xs">
              Observed {new Date(data.environment.recordedAt).toLocaleString()}{' '}
              · {data.environment.sourceType.replaceAll('_', ' ')} · Refreshes
              every 15 seconds
            </p>
          </section>
        </>
      )}
      {DEMO_MODE && <MissionJournal />}
      <section className="panel section-panel">
        <div className="section-heading">
          <h2>Priorities to review</h2>
          <Link className="text-link" href="/alerts">
            All warnings →
          </Link>
        </div>
        {alerts.error && (
          <ErrorState message={alerts.error} retry={alerts.refresh} />
        )}
        {!alerts.data && alerts.loading && (
          <LoadingState label="Loading warnings…" />
        )}
        {alerts.data?.total === 0 && (
          <EmptyState
            title="No active warnings"
            description="New mission and crew warnings will appear here."
          />
        )}
        {alerts.data?.items.map((alert) => (
          <Link href="/alerts" className="priority-row" key={alert.id}>
            <Badge value={alert.severity} />
            <span>
              <strong>{alert.title}</strong>
              <small>{new Date(alert.createdAt).toLocaleString()}</small>
            </span>
            <span aria-hidden="true">→</span>
          </Link>
        ))}
      </section>
    </div>
  );
}
