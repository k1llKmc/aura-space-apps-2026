'use client';
import { useRef } from 'react';
import type { HealthZoneStatus } from '@aura/shared-types';
import {
  DataFreshnessBadge,
  StatusBadge,
  zoneLabels,
} from '@/components/ui/aura';
const shapes = [
  { zone: 'HEAD_EYES', d: 'M100 20a24 24 0 1 1 0 48a24 24 0 1 1 0-48' },
  { zone: 'CHEST_CARDIO', d: 'M69 81Q100 69 131 81L138 135H62Z' },
  { zone: 'ABDOMEN_METABOLISM', d: 'M63 143H137L128 199H72Z' },
  {
    zone: 'SKELETON_MUSCLES',
    d: 'M58 87L43 99L28 192L44 196L64 133ZM142 87L157 99L172 192L156 196L136 133ZM72 207H96L90 322H70ZM104 207H128L130 322H110Z',
  },
  { zone: 'WHOLE_BODY_IMMUNE', d: 'M12 12H188V340H12ZM20 20V332H180V20Z' },
];
export function BodyMap({
  zones,
  selected,
  onSelect,
}: {
  zones: HealthZoneStatus[];
  selected: string;
  onSelect: (zone: string) => void;
}) {
  const refs = useRef<(SVGGElement | null)[]>([]);
  const active = zones.find((zone) => zone.zone === selected);
  return (
    <section className="panel body-map-panel" aria-labelledby="body-map-title">
      <div>
        <p className="eyebrow">Anatomical overview</p>
        <h3 id="body-map-title">Five-zone body map</h3>
        <p className="muted text-sm">
          Select a zone to inspect its evidence. Use arrow keys to move and
          Enter to select.
        </p>
      </div>
      <svg
        viewBox="0 0 200 352"
        className="body-map"
        role="group"
        aria-label="Interactive health zones"
      >
        {shapes.map((shape, index) => {
          const zone = zones.find((item) => item.zone === shape.zone);
          const label = `${zoneLabels[shape.zone]}. Risk: ${zone?.riskStatus || 'Not assessed'}. Data: ${zone?.dataState || 'MISSING'}`;
          return (
            <g
              key={shape.zone}
              ref={(node) => {
                refs.current[index] = node;
              }}
              role="button"
              tabIndex={selected === shape.zone ? 0 : -1}
              aria-label={label}
              aria-pressed={selected === shape.zone}
              className="body-map-zone"
              data-risk={zone?.riskStatus || 'UNKNOWN'}
              data-selected={selected === shape.zone}
              onClick={() => onSelect(shape.zone)}
              onKeyDown={(event) => {
                if (
                  [
                    'ArrowDown',
                    'ArrowRight',
                    'ArrowUp',
                    'ArrowLeft',
                    'Home',
                    'End',
                  ].includes(event.key)
                ) {
                  event.preventDefault();
                  const next =
                    event.key === 'Home'
                      ? 0
                      : event.key === 'End'
                        ? shapes.length - 1
                        : (index +
                            (['ArrowUp', 'ArrowLeft'].includes(event.key)
                              ? -1
                              : 1) +
                            shapes.length) %
                          shapes.length;
                  onSelect(shapes[next].zone);
                  refs.current[next]?.focus();
                } else if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelect(shape.zone);
                }
              }}
            >
              <title>{label}</title>
              <path d={shape.d} fillRule="evenodd" />
            </g>
          );
        })}
      </svg>
      <div className="body-map-selection" aria-live="polite">
        <strong>{zoneLabels[selected]}</strong>
        <div className="flex flex-wrap gap-2 mt-3">
          <StatusBadge value={active?.riskStatus} />
          <DataFreshnessBadge value={active?.dataState || 'MISSING'} />
        </div>
        <p className="muted mt-3">{active?.message}</p>
        <a className="text-link" href={`#zone-${selected}`}>
          Inspect zone evidence ↓
        </a>
      </div>
      <p className="muted text-xs">
        Outer frame: whole body & immune. Color indicates risk; data freshness
        is independent.
      </p>
    </section>
  );
}
