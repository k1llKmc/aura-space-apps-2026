'use client';
import Link from 'next/link';
import { useExperience } from './use-experience';
import { progress, asset } from './format';
import { useWorkspace } from '@/components/shell/workspace-provider';
import { portraitSource } from '@/demo/portrait-sources';
import { useCrewSession } from './crew-session';
export function ProgressBar({
  id,
  compact = false,
}: {
  id: string;
  compact?: boolean;
}) {
  const { data } = useExperience(),
    p = progress(data, id);
  return (
    <div className={`crew-progress ${compact ? 'compact' : ''}`}>
      <div className="progress-label">
        <span>
          Level {p.level} · {p.xp.toLocaleString('en-US')} XP
        </span>
        <strong>↗ {p.streak}-day streak</strong>
      </div>
      <div
        className="xp-track"
        role="progressbar"
        aria-label="Progress to next level"
        aria-valuemin={0}
        aria-valuemax={500}
        aria-valuenow={p.xp % 500}
      >
        <span style={{ width: `${p.percent}%` }} />
      </div>
      {!compact && (
        <p className="muted text-xs">
          {p.next} XP to the next level · Rewards celebrate showing up.
        </p>
      )}
    </div>
  );
}
export function CrewHero({ id }: { id: string }) {
  const source = portraitSource(id);
  const { roster } = useWorkspace(),
    member = roster.data?.find((c) => c.id === id),
    { data } = useExperience(),
    p = progress(data, id);
  return (
    <section className="panel crew-hero">
      <img
        src={member?.photoUrl || asset('/crew/1.jpg')}
        alt={
          source
            ? `${source.name}, NASA portrait used for a fictional demo profile`
            : member
              ? `Illustrative portrait for ${member.name}`
              : 'Illustrative crew portrait'
        }
      />
      <div>
        <p className="eyebrow">Crew dossier / ARES I</p>
        <h2>{member?.name || 'Crew member'}</h2>
        <p className="muted">{member?.role} · Mars transit team</p>
        {source && (
          <p className="portrait-credit">
            Photo:{' '}
            <a href={source.url} target="_blank" rel="noreferrer">
              {source.name} / NASA ↗
            </a>{' '}
            · Fictional profile; health data is synthetic.
          </p>
        )}
        <ProgressBar id={id} />
        <div className="achievement-row">
          <span>✦ {p.checks} check-ins</span>
          <span>
            {p.streak >= 7
              ? '◈ Consistency · 7 days'
              : '◈ Building consistency'}
          </span>
          <span>
            {p.memoryToday ? '◎ Mind check complete' : '◎ Ready for mind check'}
          </span>
        </div>
      </div>
    </section>
  );
}
export function TodaysMission() {
  const crewSession = useCrewSession();
  const { roster } = useWorkspace(),
    { data } = useExperience(),
    id = crewSession.crewId || roster.data?.[0]?.id || '',
    p = progress(data, id);
  const done = Number(p.checkedToday) + Number(p.memoryToday);
  return (
    <section className="panel today-mission">
      <div>
        <p className="eyebrow">Small steps. Steady progress.</p>
        <h2>Today’s mission</h2>
        <p className="muted">
          A moment for your health. A moment for your mind.
        </p>
        <span className="daily-completion">{done} / 2 rituals complete</span>
      </div>
      <Link href="/daily-check" className="ritual-card">
        <span className="ritual-number">01</span>
        <strong>Check in with yourself</strong>
        <span className="muted">Mood, recovery & sleep · +50 XP</span>
        <span>{p.checkedToday ? 'Completed ✓' : 'Start daily check →'}</span>
      </Link>
      <Link href="/daily-check#concentration" className="ritual-card">
        <span className="ritual-number">02</span>
        <strong>A little mental orbit</strong>
        <span className="muted">Number memory · +20 XP per day</span>
        <span>{p.memoryToday ? 'Completed ✓' : 'Try the mind check →'}</span>
      </Link>
    </section>
  );
}
