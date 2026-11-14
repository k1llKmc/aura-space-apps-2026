'use client';

import { useEffect, useState } from 'react';
import { ApiClientError, getCurrentMissionStatus } from '@/services/api';
import type { MissionStatusResponse } from '@/types';

export function MissionControlView() {
  const [status, setStatus] = useState<MissionStatusResponse>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    getCurrentMissionStatus().then(
      (data) => { if (active) setStatus(data); },
      (reason: unknown) => { if (active) setError(reason instanceof ApiClientError ? reason.message : 'Unable to load mission status.'); },
    );
    return () => { active = false; };
  }, []);

  if (error) return <section className="rounded-xl border border-red-800 bg-red-950/40 p-6 text-red-100"><h1 className="text-xl font-semibold">Mission Control unavailable</h1><p className="mt-2">{error}</p></section>;
  if (!status) return <section aria-live="polite" className="rounded-xl border border-slate-700 bg-slate-900 p-6 text-slate-200">Loading current mission status…</section>;

  return <section className="rounded-xl border border-cyan-900 bg-slate-900 p-6 shadow-xl shadow-cyan-950/20"><p className="text-sm font-medium uppercase tracking-[0.22em] text-cyan-300">Mission Control</p><h1 className="mt-2 text-3xl font-semibold text-white">{status.name}</h1><p className="mt-1 text-slate-300">{status.destination} · {status.phase} · Mission day {status.missionDay}</p><dl className="mt-6 grid gap-4 sm:grid-cols-3"><Metric label="Communication delay" value={status.commDelayFormatted} /><Metric label="CANS radiation" value={`${status.environment.radiationCans} mSv/day`} /><Metric label="Radiation status" value={status.hazardsStatus.spaceRadiation} /></dl></section>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-slate-800 p-4"><dt className="text-sm text-slate-400">{label}</dt><dd className="mt-1 text-lg font-semibold text-white">{value}</dd></div>;
}
