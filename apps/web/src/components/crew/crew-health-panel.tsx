'use client';
import { useEffect, useState } from 'react';
import type { AuthUser, CrewSummary, ListResponse } from '@aura/shared-types';
import { apiClient } from '@/services/api/client';
import { CrewProfile } from './crew-profile';

export function CrewHealthPanel() {
  const [crew, setCrew] = useState<CrewSummary[]>([]);
  const [actor, setActor] = useState<AuthUser>();
  const [selected, setSelected] = useState('');
  const [error, setError] = useState('');
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  useEffect(() => {
    let active = true;
    Promise.all([apiClient.get<ListResponse<CrewSummary>>(`/crew?limit=20&offset=${offset}`), apiClient.get<AuthUser>('/auth/me')])
      .then(([roster, account]) => {
        if (!active) return;
        setCrew((previous) => offset === 0 ? roster.data.items : [...previous, ...roster.data.items]);
        setActor(account.data); setSelected((value) => value || roster.data.items[0]?.id || '');
        setHasMore(offset + roster.data.items.length < roster.data.total);
      }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'Unable to load crew.'); });
    return () => { active = false; };
  }, [offset]);
  return <section className="mt-8 space-y-5" aria-labelledby="crew-heading">
    <div><p className="text-sm uppercase tracking-widest text-cyan-300">Crew health</p><h2 id="crew-heading" className="text-2xl font-semibold text-white">Measurements & reference assessment</h2></div>
    {error && <p role="alert" className="text-red-300">{error}</p>}
    {!actor && !error && <p className="text-slate-300">Loading crew…</p>}
    {actor && crew.length === 0 && <p className="text-slate-300">No crew profiles are available for your account.</p>}
    {crew.length > 0 && <label className="block text-slate-300">Crew profile<select aria-label="Crew profile" value={selected} onChange={(event) => setSelected(event.target.value)} className="mt-2 block w-full rounded-lg border border-slate-600 bg-slate-900 p-3 text-white">{crew.map((member) => <option key={member.id} value={member.id}>{member.name} · {member.role}</option>)}</select></label>}
    {hasMore && <button className="text-cyan-300 underline" onClick={() => setOffset(offset + 20)}>Load more crew</button>}
    {actor && selected && <CrewProfile key={selected} id={selected} actor={actor} />}
  </section>;
}
