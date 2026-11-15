'use client';
import { useState, type FormEvent } from 'react';
import { useSession } from './session-provider';
import { Button } from '@/components/ui/ui';
export function LoginScreen() {
  const session = useSession();
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    try {
      await session.login(
        String(data.get('username')),
        String(data.get('password')),
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to sign in.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-screen">
      <section className="login-intro">
        <p className="eyebrow">Onboard health intelligence</p>
        <div className="brand-word">
          AURA<span>+</span>
        </div>
        <h2>
          One mission.
          <br />A clearer view of every crew member.
        </h2>
        <p className="muted max-w-lg">
          Mission telemetry, personal baselines and actionable reviews —
          together in your onboard workspace.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <span className="badge badge-current">Local mission access</span>
          <span className="badge">Role-based permissions</span>
        </div>
      </section>
      <form onSubmit={submit} className="panel login-form">
        <p className="eyebrow">Crew access</p>
        <h1 className="text-3xl font-semibold">Sign in to AURA</h1>
        <p className="muted">Use your onboard account to continue.</p>
        <label>
          Username
          <input
            required
            name="username"
            autoComplete="username"
            autoCapitalize="none"
          />
        </label>
        <label>
          Password
          <input
            required
            name="password"
            type="password"
            autoComplete="current-password"
          />
        </label>
        {(error || session.message) && (
          <p
            role={error ? 'alert' : 'status'}
            className={error ? 'text-red-300' : 'muted'}
          >
            {error || session.message}
          </p>
        )}
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </Button>
        <p className="muted text-xs">
          Your session is kept in memory. Reloading requires a new sign-in.
        </p>
      </form>
    </main>
  );
}
