'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type {
  DailyHealthCheckRequest,
  DailyHealthCheckResponse,
} from '@aura/shared-types';
import { apiClient } from '@/services/api/client';
import { useNotifications } from '@/components/ui/notifications';
import {
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  MetricCard,
  Modal,
  PageHeader,
} from '@/components/ui/ui';
import { CrewSelect, useCrewSelection } from './crew-selection';
import { WellbeingSlider } from '@/components/experience/wellbeing-slider';
import { MemoryCheck } from '@/components/experience/memory-check';
import { DEMO_MODE } from '@/demo/config';
export function DailyCheckPage() {
  const query = useSearchParams();
  const { roster, selected, setSelected, invalidRequested } = useCrewSelection(
    query.get('crewMemberId'),
    true,
  );
  const { notify } = useNotifications();
  const [draft, setDraft] = useState<DailyHealthCheckRequest>();
  const [result, setResult] = useState<DailyHealthCheckResponse>();
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const request = useRef<{ fingerprint: string; key: string } | null>(null);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    setDraft(undefined);
    setResult(undefined);
    setError('');
    request.current = null;
    form.current?.reset();
  }, [selected]);
  function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const fields = new FormData(event.currentTarget);
    const symptoms = String(fields.get('symptoms') || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    if (
      symptoms.length > 20 ||
      new Set(symptoms).size !== symptoms.length ||
      symptoms.some((value) => value.length > 100)
    ) {
      setError(
        'Enter up to 20 different symptoms, each at most 100 characters.',
      );
      return;
    }
    setDraft({
      crewMemberId: selected,
      sourceType: 'MANUAL_REPORT',
      moodScore: Number(fields.get('moodScore')),
      stressScore: Number(fields.get('stressScore')),
      fatigueScore: Number(fields.get('fatigueScore')),
      sleepHours: Number(fields.get('sleepHours')),
      symptoms,
      notes: String(fields.get('notes') || '').trim(),
    });
  }
  async function save() {
    if (!draft) return;
    const fingerprint = JSON.stringify(draft);
    if (request.current?.fingerprint !== fingerprint)
      request.current = { fingerprint, key: crypto.randomUUID() };
    setBusy(true);
    setError('');
    try {
      const response = await apiClient.post<DailyHealthCheckResponse>(
        '/crew/checks',
        draft,
        { headers: { 'Idempotency-Key': request.current!.key } },
      );
      setResult(response.data);
      setDraft(undefined);
      notify(
        response.status === 200
          ? 'The previously recorded daily check was retrieved.'
          : 'Daily check recorded successfully.',
      );
    } catch (reason) {
      const message =
        reason instanceof Error
          ? reason.message
          : 'Unable to save the daily check.';
      setError(message);
      notify(message, 'error');
    } finally {
      setBusy(false);
    }
  }
  const name = roster.data?.find((member) => member.id === selected)?.name;
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Operations / Daily routine"
        title="Daily Health Check"
        description="Record mood, fatigue, sleep and symptoms. One check is accepted per crew member per UTC day."
      />
      {roster.error && (
        <ErrorState message={roster.error} retry={roster.refresh} />
      )}
      {!roster.data && roster.loading && <LoadingState label="Loading crew…" />}
      {roster.data?.length === 0 && (
        <EmptyState
          title="No accessible crew"
          description="A linked crew profile is needed to record a daily check."
        />
      )}
      {!!roster.data?.length && (
        <div className="panel section-panel">
          <div className="form-width">
            {DEMO_MODE ? (
              <div className="active-report-crew">
                <p className="eyebrow">Your daily check-in</p>
                <strong>{name}</strong>
                <p className="muted text-sm">
                  This report belongs to your selected crew profile. Change crew
                  using the selector in the header.
                </p>
              </div>
            ) : (
              <CrewSelect
                rows={roster.data}
                value={selected}
                disabled={busy}
                onChange={(value) => {
                  setResult(undefined);
                  setDraft(undefined);
                  setError('');
                  request.current = null;
                  setSelected(value);
                }}
              />
            )}
            {invalidRequested && (
              <p role="alert" className="mt-3 text-amber-300">
                The requested crew profile is unavailable to your account.
                Choose an accessible profile.
              </p>
            )}
          </div>
        </div>
      )}
      {selected && !result && (
        <form
          ref={form}
          key={`report-${selected}`}
          onSubmit={review}
          className="panel section-panel space-y-6"
        >
          <div className="section-heading">
            <h2>Report for {name}</h2>
            <span className="badge badge-current">Manual report</span>
          </div>
          <div className="form-grid">
            {[
              ['moodScore', 'Mood', '1 = very low · 10 = very good'],
              ['stressScore', 'Stress', '1 = very low · 10 = very high'],
              ['fatigueScore', 'Fatigue', '1 = very low · 10 = very high'],
            ].map(([key, label, hint]) => (
              <WellbeingSlider key={key} name={key} label={label} hint={hint} />
            ))}
            <label>
              Sleep in the last 24 hours
              <input
                aria-label="Sleep in the last 24 hours"
                aria-describedby="sleep-hint"
                name="sleepHours"
                type="number"
                required
                min={0}
                max={24}
                step="any"
              />
              <span id="sleep-hint" className="field-hint">
                Hours, from 0 to 24
              </span>
            </label>
          </div>
          <label>
            Symptoms
            <input
              name="symptoms"
              maxLength={2000}
              placeholder="Separate symptoms with commas; leave empty if none"
            />
          </label>
          <label>
            Notes
            <textarea
              name="notes"
              maxLength={2000}
              rows={4}
              placeholder="Anything the medical team should know"
            />
          </label>
          {error && <ErrorState message={error} />}
          <div className="flex flex-wrap items-center gap-4">
            <Button type="submit" variant="primary" disabled={busy}>
              Review daily check
            </Button>
            <p className="muted text-xs">
              This report does not replace zone-specific diagnostic
              measurements.
            </p>
          </div>
        </form>
      )}
      {DEMO_MODE && (
        <MemoryCheck key={`memory-${selected}`} crewId={selected} />
      )}
      {result && (
        <section className="space-y-4">
          <div className="panel section-panel">
            <p className="eyebrow">Check recorded</p>
            <h2 className="mt-2 text-2xl">Daily report saved for {name}</h2>
            <p className="muted mt-2">
              UTC date: {result.checkDate}. {result.message}
            </p>
            <Link
              className="text-link mt-4 inline-block"
              href={`/crew/${selected}`}
            >
              Open health profile →
            </Link>
          </div>
          <div className="metric-grid">
            <MetricCard
              label="XP for this check"
              value={result.xpEarned}
              detail="A replay does not award additional XP"
            />
            <MetricCard
              label="Current streak"
              value={`${result.currentStreak} days`}
              detail="Consecutive UTC dates with an accepted check"
            />
          </div>
        </section>
      )}
      <Modal
        open={!!draft}
        title="Review daily health check"
        busy={busy}
        onClose={() => {
          setDraft(undefined);
          setError('');
        }}
      >
        {draft && (
          <div className="space-y-4">
            <p>
              Recording for <strong>{name}</strong>.
            </p>
            <dl className="review-grid">
              <div>
                <dt>Mood</dt>
                <dd>{draft.moodScore}/10</dd>
              </div>
              <div>
                <dt>Stress</dt>
                <dd>{draft.stressScore}/10</dd>
              </div>
              <div>
                <dt>Fatigue</dt>
                <dd>{draft.fatigueScore}/10</dd>
              </div>
              <div>
                <dt>Sleep</dt>
                <dd>{draft.sleepHours} hours</dd>
              </div>
            </dl>
            <p className="muted">
              Symptoms: {draft.symptoms.join(', ') || 'None reported'}
            </p>
            {draft.notes && (
              <p className="whitespace-pre-wrap break-words">{draft.notes}</p>
            )}
            {error && <ErrorState message={error} />}
            <div className="flex gap-3">
              <Button variant="primary" disabled={busy} onClick={save}>
                {busy ? 'Saving…' : 'Confirm and save'}
              </Button>
              <Button disabled={busy} onClick={() => setDraft(undefined)}>
                Keep editing
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
