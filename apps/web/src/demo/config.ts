export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
export const DEMO_STORAGE = 'aura-public-demo-v2';
export const demoCrewIds = [1, 2, 3, 4, 5, 6].map(
  (n) => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
);
export const demoUser = {
  id: 'demo-operator',
  username: 'Mission operator · demo',
  role: 'COMMANDER' as const,
  missionId: 'aura-ares-01',
  crewMemberId: null,
};
export const demoRoster = demoCrewIds.map((id, i) => ({
  id,
  name: [
    'Elena Vasquez',
    'Marcus Chen',
    'Amara Okafor',
    'Luca Moretti',
    'Sofia Andersson',
    'Noah Patel',
  ][i],
  role: [
    'Mission Commander',
    'Flight Engineer',
    'Medical Officer',
    'Research Specialist',
    'Systems Engineer',
    'Pilot',
  ][i],
  photoUrl: `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/crew/${i + 1}.jpg`,
}));
