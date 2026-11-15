'use client';
import { useId, useRef } from 'react';
import type { HealthZoneStatus } from '@aura/shared-types';
import { asset } from '@/components/experience/format';
import {
  DataFreshnessBadge,
  StatusBadge,
  zoneLabels,
} from '@/components/ui/aura';
const shapes = [
  { zone: 'HEAD_EYES', x: 100, y: 29 },
  { zone: 'CHEST_CARDIO', x: 100, y: 105 },
  { zone: 'ABDOMEN_METABOLISM', x: 100, y: 165 },
  { zone: 'SKELETON_MUSCLES', x: 79, y: 265 },
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
  const imageClip = useId().replaceAll(':', '');
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
        <svg
          x="0"
          y="0"
          width="200"
          height="400"
          viewBox="0 0 326 740"
          overflow="hidden"
          className="body-reference-image"
          aria-hidden="true"
        >
          <defs>
            <clipPath id={imageClip}>
              <rect x="0" y="0" width="326" height="740" />
            </clipPath>
          </defs>
          <image
            clipPath={`url(#${imageClip})`}
            href={asset('/body-reference.png')}
            x="0"
            y="0"
            width="653"
            height="740"
          />
        </svg>
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
