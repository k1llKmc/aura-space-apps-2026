'use client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { DEMO_MODE, demoRoster } from '@/demo/config';
import { asset } from './format';
const key = 'aura-active-demo-crew';
type Phase = 'boot' | 'choose' | 'loading' | 'ready';
const Context = createContext<{
  crewId: string;
  phase: Phase;
  chooseCrew: (id: string) => void;
}>({ crewId: '', phase: 'ready', chooseCrew: () => {} });
export function CrewSessionProvider({ children }: { children: ReactNode }) {
  const [crewId, setCrewId] = useState(''),
    [phase, setPhase] = useState<Phase>(DEMO_MODE ? 'boot' : 'ready');
  const chooseCrew = useCallback((id: string) => {
    if (!demoRoster.some((c) => c.id === id)) return;
    setCrewId(id);
    try {
      sessionStorage.setItem(key, id);
    } catch {}
    setPhase('loading');
  }, []);
  useEffect(() => {
    if (!DEMO_MODE) return;
    let saved: string | null = null;
    try {
      saved = sessionStorage.getItem(key);
    } catch {}
    if (saved && demoRoster.some((c) => c.id === saved)) {
      setCrewId(saved);
      setPhase('loading');
    } else setPhase('choose');
  }, []);
  useEffect(() => {
    if (phase !== 'loading') return;
    const timer = setTimeout(() => setPhase('ready'), 650);
    return () => clearTimeout(timer);
  }, [phase]);
  return (
    <Context.Provider value={{ crewId, phase, chooseCrew }}>
      {children}
    </Context.Provider>
  );
}
export const useCrewSession = () => useContext(Context);
export function CrewEntryGate({ children }: { children: ReactNode }) {
  const { phase, chooseCrew } = useCrewSession(),
    [choice, setChoice] = useState(demoRoster[0].id);
  if (!DEMO_MODE || phase === 'ready') return <>{children}</>;
  return (
    <div className="crew-entry" aria-busy={phase !== 'choose'}>
      <div className="crew-entry-center">
        <img
          className="crew-entry-logo"
          src={asset('/aura-logo.png')}
          alt="AURA"
        />
        {phase === 'choose' ? (
          <form
            className="crew-entry-form"
            onSubmit={(e) => {
              e.preventDefault();
              chooseCrew(choice);
            }}
          >
            <p className="entry-eyebrow">ARES I / Mars Transit</p>
            <h1>Welcome aboard.</h1>
            <p>Choose your crew profile to begin.</p>
            <label htmlFor="entry-crew">Crew member</label>
            <select
              id="entry-crew"
              value={choice}
              onChange={(e) => setChoice(e.target.value)}
            >
              {demoRoster.map((member) => (
                <option value={member.id} key={member.id}>
                  {member.name} · {member.role}
                </option>
              ))}
            </select>
            <button type="submit">Enter mission →</button>
            <small>A fictional mission workspace. No password required.</small>
          </form>
        ) : (
          <div
            className="crew-entry-loading"
            role="status"
            aria-label="Loading crew workspace"
          >
            <span className="entry-loader" />
            <span>Preparing your workspace…</span>
          </div>
        )}
      </div>
      <p className="crew-entry-footnote">
        AURA · AI generated · Interactive mission demo
      </p>
    </div>
  );
}
