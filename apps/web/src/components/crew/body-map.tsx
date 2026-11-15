'use client';
import { useRef } from 'react';
import type { HealthZoneStatus } from '@aura/shared-types';
import {
  DataFreshnessBadge,
  StatusBadge,
  zoneLabels,
} from '@/components/ui/aura';
const shapes = [
  { zone: 'HEAD_EYES', x: 100, y: 38 },
  { zone: 'CHEST_CARDIO', x: 100, y: 113 },
  { zone: 'ABDOMEN_METABOLISM', x: 100, y: 174 },
  { zone: 'SKELETON_MUSCLES', x: 79, y: 259 },
  { zone: 'WHOLE_BODY_IMMUNE', x: 143, y: 145 },
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
          One body. Five perspectives. Select a marker to explore.
        </p>
      </div>
      <svg
        viewBox="0 0 200 400"
        className="body-map"
        role="group"
        aria-label="Interactive health zones"
      >
        <ellipse cx="100" cy="383" rx="53" ry="8" className="body-shadow" />
        <path
          className="body-silhouette"
          d="M100 12 C85 12 78 23 79 40 C73 41 77 54 82 55 L84 67 C77 76 51 77 43 92 C36 108 38 131 32 151 L23 190 L18 212 C12 221 7 238 12 239 L24 225 C21 240 21 246 25 245 L32 223 C36 218 34 204 37 193 L48 163 L55 128 L62 163 C59 186 59 207 65 228 C66 257 66 281 73 303 L76 350 L71 370 C66 381 78 383 86 380 L94 375 L94 350 L95 296 L100 235 L105 296 L106 350 L106 375 L114 380 C122 383 134 381 129 370 L124 350 L127 303 C134 281 134 257 135 228 C141 207 141 186 138 163 L145 128 L152 163 L163 193 C166 204 164 218 168 223 L175 245 C179 246 179 240 176 225 L188 239 C193 238 188 221 182 212 L177 190 L168 151 C162 131 164 108 157 92 C149 77 123 76 116 67 L118 55 C123 54 127 41 121 40 C122 23 115 12 100 12 Z"
        />
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
              <circle className="marker-hit" cx={shape.x} cy={shape.y} r="16" />
              <circle
                className="marker-ring"
                cx={shape.x}
                cy={shape.y}
                r="10"
              />
              <circle className="marker-core" cx={shape.x} cy={shape.y} r="4" />
              <text
                className="marker-tooltip"
                x="100"
                y="397"
                textAnchor="middle"
              >
                {zoneLabels[shape.zone]}
              </text>
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
        Hover or focus a marker for its name. Arrow keys move between markers;
        Enter selects. Risk and freshness are shown separately.
      </p>
    </section>
  );
}
