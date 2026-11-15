'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { apiClient } from '@/services/api/client';
import { Button, ErrorState } from '@/components/ui/ui';
export function MemoryCheck({ crewId }: { crewId: string }) {
  const [phase, setPhase] = useState<'ready' | 'show' | 'answer' | 'result'>(
      'ready',
    ),
    [sequence, setSequence] = useState(''),
    [round, setRound] = useState(0),
    [score, setScore] = useState(0),
    [answer, setAnswer] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null),
    identity = useRef(crewId);
  useEffect(() => {
    identity.current = crewId;
    setPhase('ready');
    setScore(0);
    setRound(0);
    setError('');
  }, [crewId]);
  useEffect(() => {
    if (phase !== 'show') return;
    const timer = setTimeout(() => {
      setPhase('answer');
      setAnswer('');
    }, 3000);
    return () => clearTimeout(timer);
  }, [phase, round]);
  useEffect(() => {
    if (phase === 'answer') input.current?.focus();
  }, [phase]);
  function begin(next: number) {
    setSequence(
      Array.from(crypto.getRandomValues(new Uint8Array(next + 3)), (v) =>
        String(v % 10),
      ).join(''),
    );
    setRound(next);
    setPhase('show');
    setAnswer('');
    setError('');
  }
  async function finish(event: FormEvent) {
    event.preventDefault();
    const updated = score + Number(answer === sequence);
    if (round < 2) {
      setScore(updated);
      begin(round + 1);
      return;
    }
    const owner = crewId;
    setBusy(true);
    setError('');
    try {
      await apiClient.post('/experience/memory', {
        crewMemberId: owner,
        correct: updated,
        rounds: 3,
      });
      if (identity.current === owner) {
        setScore(updated);
        setPhase('result');
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Unable to save the mind check. Try again.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel memory-check" id="concentration">
      <div>
        <p className="eyebrow">Mind / A small daily ritual</p>
        <h2>A little mental orbit</h2>
        <p className="muted">Remember the digits. Find your focus.</p>
        <p className="muted text-sm">
          Three rounds · 3 seconds to remember each sequence · +20 XP once per
          UTC day for participating, whatever your score.
        </p>
        <p className="muted text-xs">
          A playful memory exercise, not a clinical assessment. Take your time
          recalling each sequence.
        </p>
      </div>
      <div className="memory-stage" aria-live="polite">
        {phase === 'ready' ? (
          <>
            <span className="memory-orbit" aria-hidden="true">
              ◎
            </span>
            <p>Ready for a fresh perspective?</p>
            <Button
              variant="primary"
              disabled={!crewId}
              onClick={() => {
                setScore(0);
                begin(0);
              }}
            >
              Begin memory check
            </Button>
          </>
        ) : phase === 'show' ? (
          <>
            <p className="eyebrow">Round {round + 1} / 3 · Memorise</p>
            <strong className="memory-digits" data-testid="memory-sequence">
              {sequence}
            </strong>
            <p className="muted">Hold these numbers in your mind.</p>
          </>
        ) : phase === 'answer' ? (
          <form onSubmit={finish}>
            <p className="eyebrow">Round {round + 1} / 3 · Recall</p>
            <label>
              Which digits did you see?
              <input
                ref={input}
                aria-label="Remembered digits"
                inputMode="numeric"
                pattern="[0-9]+"
                maxLength={round + 3}
                required
                value={answer}
                onChange={(e) => setAnswer(e.target.value.replace(/\D/g, ''))}
                autoComplete="off"
              />
            </label>
            <Button type="submit" variant="primary" disabled={busy}>
              {busy
                ? 'Saving…'
                : round === 2
                  ? 'Finish mind check'
                  : 'Next round'}
            </Button>
          </form>
        ) : (
          <>
            <span className="memory-orbit" aria-hidden="true">
              ✦
            </span>
            <h3>Mind check complete</h3>
            <strong className="memory-result">{score} / 3 recalled</strong>
            <p className="muted">
              Showing up is the achievement. Your result is in the mission
              journal.
            </p>
            <Button
              onClick={() => {
                setPhase('ready');
                setScore(0);
              }}
            >
              Practice again
            </Button>
          </>
        )}
        {error && <ErrorState message={error} />}
      </div>
    </section>
  );
}
