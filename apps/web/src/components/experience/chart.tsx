'use client';
import { useId, useState } from 'react';
export interface ChartPoint {
  label: string;
  value: number;
}
export function TrendChart({
  points,
  label,
  unit = '',
  color = 'var(--chart-accent)',
}: {
  points: ChartPoint[];
  label: string;
  unit?: string;
  color?: string;
}) {
  const [active, setActive] = useState<number | null>(null),
    gradient = useId().replaceAll(':', '');
  if (!points.length)
    return (
      <p className="muted">
        No entries in this period. Complete a daily check to begin.
      </p>
    );
  const values = points.map((p) => p.value),
    low = Math.min(...values),
    high = Math.max(...values),
    span = Math.max(high - low, 1);
  const x = (i: number) => 20 + (i * 560) / Math.max(points.length - 1, 1),
    y = (v: number) => 125 - ((v - low) * 90) / span;
  const line = points
      .map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.value)}`)
      .join(' '),
    current = points[Math.min(active ?? points.length - 1, points.length - 1)];
  return (
    <div className="trend-chart">
      <div className="chart-readout">
        <span>{label}</span>
        <strong>
          {current.value}
          <small>{unit}</small>
        </strong>
        <span className="muted">{current.label}</span>
      </div>
      <svg
        viewBox="0 0 600 155"
        role="group"
        aria-label={`${label} history. Use Tab to inspect each value.`}
      >
        <defs>
          <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity=".22" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[35, 80, 125].map((v) => (
          <line
            key={v}
            x1="20"
            x2="580"
            y1={v}
            y2={v}
            className="chart-grid-line"
          />
        ))}
        <path
          d={`${line} L${x(points.length - 1)},140 L20,140 Z`}
          fill={`url(#${gradient})`}
        />
        <path
          d={line}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {points.map((point, i) => (
          <g
            key={point.label + i}
            tabIndex={0}
            role="button"
            aria-label={`${point.label}: ${point.value} ${unit}`}
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(null)}
            onFocus={() => setActive(i)}
            onBlur={() => setActive(null)}
            onClick={() => setActive(i)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setActive(i);
              }
            }}
          >
            <circle cx={x(i)} cy={y(point.value)} r="10" fill="transparent" />
            <circle
              cx={x(i)}
              cy={y(point.value)}
              r={active === i ? 5 : 2.5}
              fill={color}
            />
            <title>
              {point.label}: {point.value} {unit}
            </title>
          </g>
        ))}
      </svg>
      <div className="chart-axis">
        <span>{points[0].label}</span>
        <span>{points[points.length - 1].label}</span>
      </div>
    </div>
  );
}
export function PeriodPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="period-picker" role="group" aria-label="Chart period">
      {[1, 7, 30].map((n) => (
        <button key={n} aria-pressed={value === n} onClick={() => onChange(n)}>
          {n === 1 ? '24 hours' : `${n} days`}
        </button>
      ))}
    </div>
  );
}
