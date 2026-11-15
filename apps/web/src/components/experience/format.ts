export const asset = (path: string) =>
  `${process.env.NEXT_PUBLIC_BASE_PATH || ''}${path}`;
const names: Record<string, string> = {
  intraocularPressure: 'Eye pressure',
  octRetinalThickness: 'Retinal thickness',
  visualAcuity: 'Visual acuity',
  heartRateResting: 'Resting heart rate',
  systolicPressure: 'Systolic pressure',
  diastolicPressure: 'Diastolic pressure',
  fastingGlucose: 'Fasting glucose',
  bodyMass: 'Body mass',
  whiteBloodCells: 'White blood cells',
  cReactiveProtein: 'C-reactive protein',
  muscleMass: 'Muscle mass',
  boneMineralDensity: 'Bone mineral density',
  spineTScore: 'Spine T-score',
  moodScore: 'Mood',
  stressScore: 'Stress',
  fatigueScore: 'Fatigue',
  sleepHours: 'Sleep',
  sourceType: 'Source',
  crewMemberId: 'Crew member',
  recordedAt: 'Recorded',
  allowedSources: 'Accepted sources',
  attentionDelta: 'Attention deviation',
  criticalDelta: 'Critical deviation',
};
export function friendly(value: string) {
  return (
    names[value] ||
    value
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replaceAll('_', ' ')
      .toLowerCase()
      .replace(/^./, (c) => c.toUpperCase())
  );
}
export function dateLabel(value: string) {
  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });
}
export function moodLabel(value: number) {
  return value === 1
    ? 'Very low'
    : value <= 5
      ? 'Low'
      : value <= 8
        ? 'Good'
        : 'Great';
}
export interface MemoryResult {
  crewMemberId: string;
  recordedAt: string;
  correct: number;
  rounds: number;
}
export interface ExperienceData {
  records: Record<
    string,
    { recordedAt: string; metrics: unknown; zone: string | null }[]
  >;
  audit: {
    id: string;
    crewMemberId: string | null;
    action: string;
    createdAt: string;
    details: unknown;
  }[];
  memoryTests: MemoryResult[];
}
export function progress(data: ExperienceData | undefined, id: string) {
  const days = [
    ...new Set(
      (data?.records[id] || [])
        .filter((r) => !r.zone)
        .map((r) => r.recordedAt.slice(0, 10)),
    ),
  ]
    .sort()
    .reverse();
  const today = new Date().toISOString().slice(0, 10),
    yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  let streak = 0,
    cursor = days.includes(today) ? today : yesterday;
  while (days.includes(cursor)) {
    streak++;
    cursor = new Date(Date.parse(cursor + 'T00:00:00Z') - 86400000)
      .toISOString()
      .slice(0, 10);
  }
  const memoryDays = new Set(
    (data?.memoryTests || [])
      .filter((r) => r.crewMemberId === id)
      .map((r) => r.recordedAt.slice(0, 10)),
  );
  const xp = days.length * 50 + memoryDays.size * 20;
  return {
    xp,
    level: Math.floor(xp / 500) + 1,
    next: 500 - (xp % 500),
    percent: (xp % 500) / 5,
    streak,
    checks: days.length,
    checkedToday: days.includes(today),
    memoryToday: memoryDays.has(today),
  };
}
