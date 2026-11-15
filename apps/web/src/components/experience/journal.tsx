'use client';
import { useState } from 'react';
import { useExperience } from './use-experience';
import { useWorkspace } from '@/components/shell/workspace-provider';
import { dateLabel, friendly } from './format';
import { EmptyState } from '@/components/ui/ui';
export function ReadableData({ value }: { value: unknown }) {
  if (value === null || value === undefined)
    return <p className="muted">No additional details.</p>;
  if (Array.isArray(value))
    return (
      <div className="readable-stack">
        {value.map((item, i) => (
          <ReadableData key={i} value={item} />
        ))}
      </div>
    );
  if (typeof value !== 'object')
    return (
      <p>
        {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)}
      </p>
    );
  return (
    <dl className="readable-data">
      {Object.entries(value)
        .filter(
          ([key]) =>
            ![
              'crewMemberId',
              'id',
              'schemaVersion',
              'baselineId',
              'recordId',
              'checkId',
              'sourceType',
              'rulesVersion',
            ].includes(key),
        )
        .map(([key, item]) => (
          <div key={key}>
            <dt>{friendly(key)}</dt>
            <dd>
              {item && typeof item === 'object' ? (
                <ReadableData value={item} />
              ) : typeof item === 'boolean' ? (
                item ? (
                  'Yes'
                ) : (
                  'No'
                )
              ) : typeof item === 'number' ? (
                Number(item.toFixed(2))
              ) : (
                String(item ?? 'Not available')
              )}
            </dd>
          </div>
        ))}
    </dl>
  );
}
export function MissionJournal({ crewId }: { crewId?: string }) {
  const { data } = useExperience(),
    { roster } = useWorkspace(),
    [type, setType] = useState('all'),
    [member, setMember] = useState('all'),
    [limit, setLimit] = useState(8);
  const owner = crewId || member;
  const entries = [
    ...Object.entries(data?.records || {}).flatMap(([id, records]) =>
      records.map((record, i) => ({
        id: `record-${id}-${record.recordedAt}-${i}`,
        crew: id,
        type: record.zone ? 'measurement' : 'check-in',
        title: record.zone ? 'Measurement recorded' : 'Daily health check',
        date: record.recordedAt,
        detail: record.zone
          ? 'Diagnostic measurement added to the crew health record.'
          : `Mood ${String((record.metrics as Record<string, unknown>).moodScore ?? '—')}/10 · Sleep ${String((record.metrics as Record<string, unknown>).sleepHours ?? '—')} h`,
      })),
    ),
    ...(data?.memoryTests || []).map((r, i) => ({
      id: `memory-${i}`,
      crew: r.crewMemberId,
      type: 'memory',
      title: 'Mind check complete',
      date: r.recordedAt,
      detail: `${r.correct} / ${r.rounds} sequences recalled · Participation counts, not the score.`,
    })),
    ...(data?.audit || [])
      .filter((a) => !['HEALTH_RECORD_CREATED'].includes(a.action))
      .map((a) => ({
        id: a.id,
        crew: a.crewMemberId,
        type: a.action === 'ALERT_RESOLVED' ? 'review' : 'reference',
        title: friendly(a.action),
        date: a.createdAt,
        detail:
          a.action === 'ALERT_RESOLVED'
            ? 'Warning reviewed and acknowledged.'
            : 'Individual reference policy updated.',
      })),
  ]
    .filter(
      (e) =>
        (owner === 'all' || e.crew === owner) &&
        (type === 'all' || e.type === type),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  return (
    <section className="panel section-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Every action tells a story</p>
          <h2>Mission journal</h2>
        </div>
        <span className="muted text-sm">{entries.length} entries</span>
      </div>
      <div className="journal-filters">
        <label>
          Activity type
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setLimit(8);
            }}
          >
            {[
              ['all', 'All activity'],
              ['check-in', 'Daily checks'],
              ['measurement', 'Measurements'],
              ['memory', 'Mind checks'],
              ['review', 'Warning reviews'],
              ['reference', 'Reference updates'],
            ].map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        {!crewId && (
          <label>
            Crew member
            <select
              value={member}
              onChange={(e) => {
                setMember(e.target.value);
                setLimit(8);
              }}
            >
              <option value="all">All crew</option>
              {roster.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {entries.length ? (
        <ol className="journal-list">
          {entries.slice(0, limit).map((e) => (
            <li key={e.id}>
              <span
                className="journal-dot"
                data-type={e.type}
                aria-hidden="true"
              />
              <div>
                <div className="journal-title">
                  <strong>{e.title}</strong>
                  <time dateTime={e.date}>
                    {dateLabel(e.date)} ·{' '}
                    {new Date(e.date).toLocaleTimeString('en-GB', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </time>
                </div>
                <p>
                  {roster.data?.find((c) => c.id === e.crew)?.name ||
                    'Mission crew'}
                </p>
                <p className="muted text-sm">{e.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState
          title="A fresh page"
          description="New checks, measurements and reviews will appear here."
        />
      )}
      {entries.length > limit && (
        <button
          className="button button-secondary"
          onClick={() => setLimit((v) => v + 8)}
        >
          Show more activity
        </button>
      )}
    </section>
  );
}
