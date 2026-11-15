'use client';
import { useEffect, useState } from 'react';
import type { CrewSummary } from '@aura/shared-types';
import { useWorkspace } from '@/components/shell/workspace-provider';
import { useCrewSession } from '@/components/experience/crew-session';
import { DEMO_MODE, demoRoster } from '@/demo/config';
export function useCrewSelection(
  requested: string | null = null,
  followActive = false,
) {
  const { roster } = useWorkspace();
  const crewSession = useCrewSession();
  const [localSelected, setLocalSelected] = useState('');
  const selected =
    DEMO_MODE && followActive ? crewSession.crewId : localSelected;
  const setSelected =
    DEMO_MODE && followActive ? crewSession.chooseCrew : setLocalSelected;
  useEffect(() => {
    if (
      DEMO_MODE &&
      followActive &&
      requested &&
      requested !== crewSession.crewId &&
      demoRoster.some((c) => c.id === requested)
    )
      crewSession.chooseCrew(requested);
  }, [requested, followActive, crewSession.crewId, crewSession.chooseCrew]);
  useEffect(() => {
    if (!roster.data) return;
    if (DEMO_MODE && followActive) return;
    setLocalSelected((current) =>
      roster.data!.some((member) => member.id === current)
        ? current
        : requested
          ? roster.data!.some((member) => member.id === requested)
            ? requested
            : ''
          : crewSession.crewId || roster.data![0]?.id || '',
    );
  }, [roster.data, requested, followActive, crewSession.crewId]);
  return {
    roster,
    selected,
    setSelected,
    invalidRequested:
      !!requested &&
      !!roster.data &&
      !selected &&
      !roster.data.some((member) => member.id === requested),
  };
}
export function CrewSelect({
  rows,
  value,
  onChange,
  label = 'Crew member',
  disabled = false,
}: {
  rows: CrewSummary[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <label>
      {label}
      <select
        aria-label={label}
        required
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="" disabled>
          Choose a crew member
        </option>
        {rows.map((member) => (
          <option value={member.id} key={member.id}>
            {member.name} · {member.role}
          </option>
        ))}
      </select>
    </label>
  );
}
