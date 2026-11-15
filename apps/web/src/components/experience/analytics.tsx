'use client';
import { useState } from 'react';
import type { MissionEnvironment } from '@aura/shared-types';
import { TrendChart, PeriodPicker } from './chart';
import { useExperience } from './use-experience';
import { dateLabel, friendly } from './format';
const cabin = [
  ['co2Ppm', 'Carbon dioxide', 'ppm'],
  ['temperature', 'Temperature', '°C'],
  ['humidity', 'Humidity', '%'],
  ['pO2', 'Oxygen pressure', 'kPa'],
  ['cabinPressure', 'Cabin pressure', 'kPa'],
  ['radiationCans', 'Radiation', 'mSv/day'],
] as const;
export function CabinTrends({
  environment,
}: {
  environment: MissionEnvironment;
}) {
  const [period, setPeriod] = useState(1),
    [metric, setMetric] = useState<(typeof cabin)[number][0]>('co2Ppm');
  const meta = cabin.find((m) => m[0] === metric)!;
  const count = period === 1 ? 24 : period;
  const points = Array.from({ length: count }, (_, i) => {
    const delta = count - 1 - i;
    return {
      label:
        period === 1
          ? `${delta}h ago`
          : dateLabel(new Date(Date.now() - delta * 86400000).toISOString()),
      value: Number(
        (environment[metric] * (1 + Math.sin(delta * 0.7) * 0.035)).toFixed(
          metric === 'co2Ppm' ? 0 : 2,
        ),
      ),
    };
  });
  return (
    <section className="panel section-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Habitat / Environmental rhythm</p>
          <h2>Life inside the cabin</h2>
        </div>
        <PeriodPicker value={period} onChange={setPeriod} />
      </div>
      <div
        className="metric-tabs"
        role="group"
        aria-label="Environmental metric"
      >
        {cabin.map((m) => (
          <button
            key={m[0]}
            aria-pressed={metric === m[0]}
            onClick={() => setMetric(m[0])}
          >
            {m[1]}
          </button>
        ))}
      </div>
      <TrendChart points={points} label={meta[1]} unit={meta[2]} />
      <p className="muted text-xs">
        Illustrative telemetry history · Synthetic mission data, not a live
        sensor feed.
      </p>
    </section>
  );
}
export function HealthTrends({ id }: { id: string }) {
  const { data } = useExperience(),
    [period, setPeriod] = useState(7),
    [metric, setMetric] = useState('moodScore');
  const records = (data?.records[id] || [])
    .filter(
      (r) =>
        !r.zone && Date.parse(r.recordedAt) >= Date.now() - period * 86400000,
    )
    .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  const points = records.flatMap((r) => {
    const value = (r.metrics as Record<string, unknown>)[metric];
    return typeof value === 'number'
      ? [{ label: dateLabel(r.recordedAt), value }]
      : [];
  });
  return (
    <section className="panel section-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Your rhythm / Daily check-ins</p>
          <h2>Wellbeing over time</h2>
        </div>
        <PeriodPicker value={period} onChange={setPeriod} />
      </div>
      <div className="metric-tabs" role="group" aria-label="Health metric">
        {['moodScore', 'stressScore', 'fatigueScore', 'sleepHours'].map((m) => (
          <button
            key={m}
            aria-pressed={m === metric}
            onClick={() => setMetric(m)}
          >
            {friendly(m)}
          </button>
        ))}
      </div>
      <TrendChart
        points={points}
        label={friendly(metric)}
        unit={metric === 'sleepHours' ? 'hours' : '/ 10'}
      />
      <p className="muted text-xs">
        Based on recorded check-ins. Gaps are not filled with invented
        measurements.
      </p>
    </section>
  );
}
