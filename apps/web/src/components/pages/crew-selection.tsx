'use client';
import { useEffect, useState } from 'react';
import type { CrewSummary } from '@aura/shared-types';
import { useWorkspace } from '@/components/shell/workspace-provider';
export function useCrewSelection(requested: string | null = null) {
  const { roster } = useWorkspace();
  const [selected, setSelected] = useState('');
  useEffect(() => {
    if (!roster.data) return;
    setSelected((current) =>
      roster.data!.some((member) => member.id === current)
        ? current
        : requested
          ? roster.data!.some((member) => member.id === requested)
            ? requested
            : ''
          : roster.data![0]?.id || '',
    );
  }, [roster.data, requested]);
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
}: {
  rows: CrewSummary[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
}) {
  return (
    <label>
      {label}
      <select
        aria-label={label}
        required
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
