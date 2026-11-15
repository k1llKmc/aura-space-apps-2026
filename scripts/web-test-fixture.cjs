const { PrismaClient } = require('@prisma/client');
const { randomUUID, randomBytes, scrypt } = require('node:crypto');
const { promisify } = require('node:util');
const prisma = new PrismaClient();
async function main() {
  if (process.env.AURA_E2E_SETUP !== '1') throw new Error('Fixture setup is for isolated test environments. Set AURA_E2E_SETUP=1 explicitly.');
  if (process.argv[2] === 'cleanup') {
    let input = ''; for await (const part of process.stdin) input += part;
    const fixture = JSON.parse(input);
    if (!/^[a-f0-9]{8}$/.test(fixture.suffix)) throw new Error('Invalid test fixture identity.');
    await prisma.user.deleteMany({ where: { username: { in: [`e2e-crew-${fixture.suffix}`, `e2e-created-${fixture.suffix}`] } } });
    await prisma.crewMember.deleteMany({ where: { id: fixture.crewId, name: `A E2E Crew ${fixture.suffix}` } });
    return;
  }
  const mission = await prisma.mission.findFirst({ where: { isCurrent: true } });
  if (!mission) throw new Error('Seed a current test mission first.');
  const other = await prisma.crewMember.findFirst({ where: { missionId: mission.id } });
  const suffix = randomUUID().slice(0, 8), crewPassword = randomBytes(24).toString('hex');
  const salt = randomBytes(16).toString('hex'), hash = await promisify(scrypt)(crewPassword, salt, 64);
  const fixture = await prisma.$transaction(async (tx) => {
    const crew = await tx.crewMember.create({ data: { missionId: mission.id, name: `A E2E Crew ${suffix}`, role: 'Synthetic UI test', age: 30 } });
    await tx.user.create({ data: { username: `e2e-crew-${suffix}`, passwordHash: `scrypt:${salt}:${hash.toString('hex')}`, role: 'CREW_MEMBER', missionId: mission.id, crewMemberId: crew.id } });
    await tx.individualBaseline.create({ data: { crewMemberId: crew.id, zone: 'HEAD_EYES', baselineData: { schemaVersion: 1, rules: [{ metric: 'intraocularPressure', unit: 'mmHg', baseline: 100, comparison: 'PERCENT', direction: 'BOTH', attentionDelta: 5, criticalDelta: 10, allowedSources: ['DIAGNOSTIC_DEVICE'] }] } } });
    await tx.healthRecord.create({ data: { crewMemberId: crew.id, zone: 'HEAD_EYES', sourceType: 'DIAGNOSTIC_DEVICE', metrics: { intraocularPressure: 100 }, units: { intraocularPressure: 'mmHg' }, symptoms: [] } });
    const alert = await tx.alert.create({ data: { missionId: mission.id, crewMemberId: crew.id, severity: 'ATTENTION', hazardType: 'HOSTILE_ENVIRONMENT', title: `E2E review ${suffix}`, message: 'Synthetic review warning for the interface test.' } });
    return { suffix, crewId: crew.id, crewName: crew.name, crewUsername: `e2e-crew-${suffix}`, crewPassword, createdUsername: `e2e-created-${suffix}`, alertTitle: alert.title, otherCrewId: other?.id };
  });
  // Caller captures this into an ignored fixture file; do not print it in CI logs.
  process.stdout.write(JSON.stringify(fixture));
}
void main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
