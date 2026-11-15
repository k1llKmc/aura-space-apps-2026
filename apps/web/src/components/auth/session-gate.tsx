'use client';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import type { AuthUser, LoginResponse } from '@aura/shared-types';
import { apiClient, setAccessToken } from '@/services/api/client';

export function SessionGate({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const expired = () => { setUser(undefined); setError('Your session has expired. Sign in again.'); };
    window.addEventListener('aura:unauthorized', expired);
    return () => window.removeEventListener('aura:unauthorized', expired);
  }, []);
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    setBusy(true); setError('');
    try {
      const { data } = await apiClient.post<LoginResponse>('/auth/login', { username: fields.get('username'), password: fields.get('password') });
      setAccessToken(data.accessToken); setUser(data.user);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to sign in.'); }
    finally { setBusy(false); }
  }
  if (user) return <><div className="mb-4 flex items-center justify-between gap-4 text-slate-300"><span>{user.username} · {user.role.replaceAll('_', ' ')}</span><button className="rounded border border-slate-600 px-3 py-2" onClick={async () => {
    try { await apiClient.post('/auth/logout'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to end the server session.'); }
    finally { setAccessToken(); setUser(undefined); }
  }}>Sign out</button></div>{children}</>;
  return <form onSubmit={login} className="mx-auto max-w-md space-y-4 rounded-xl border border-slate-700 bg-slate-900 p-6">
    <h1 className="text-2xl text-white">Sign in to AURA</h1><p className="text-slate-300">Use your onboard account to access your mission.</p>
    <label className="block text-slate-200">Username<input required name="username" autoComplete="username" className="mt-1 block w-full rounded bg-slate-800 p-3" /></label>
    <label className="block text-slate-200">Password<input required name="password" type="password" autoComplete="current-password" className="mt-1 block w-full rounded bg-slate-800 p-3" /></label>
    {error && <p role="alert" className="text-red-300">{error}</p>}
    <button disabled={busy} className="rounded bg-cyan-300 px-4 py-2 font-medium text-slate-950 disabled:opacity-50">{busy ? 'Signing in…' : 'Sign in'}</button>
  </form>;
}
