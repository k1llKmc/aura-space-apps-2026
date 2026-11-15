import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  await prisma.$connect();
  const [missions, currentMissions, crewMembers, baselines, healthRecords, environmentRecords, alerts, protocols] = await Promise.all([
    prisma.mission.count(), prisma.mission.count({ where: { isCurrent: true } }), prisma.crewMember.count(), prisma.individualBaseline.count(),
    prisma.healthRecord.count(), prisma.environmentRecord.count(), prisma.alert.count(), prisma.countermeasureProtocol.count(),
  ]);
  const expected = { missions: 4, currentMissions: 1, crewMembers: 4, baselines: 2, healthRecords: 2, environmentRecords: 2, alerts: 2, protocols: 3 };
  const actual = { missions, currentMissions, crewMembers, baselines, healthRecords, environmentRecords, alerts, protocols };
  const mismatches = Object.entries(expected).filter(([key, value]) => key === 'alerts'
    ? actual.alerts < value : actual[key as keyof typeof actual] !== value);
  if (mismatches.length > 0) throw new Error(`Seed verification failed: ${mismatches.map(([key, value]) => `${key} expected ${value}, received ${actual[key as keyof typeof actual]}`).join('; ')}`);
  console.log(`Database smoke test passed: ${JSON.stringify(actual)}`);
}

main().catch((error: unknown) => { console.error('Database smoke test failed:', error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
