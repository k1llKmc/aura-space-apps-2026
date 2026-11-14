import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PrismaClient, Prisma } from '@prisma/client';
const prisma = new PrismaClient();
type Data = any;
async function main() {
  const data = JSON.parse(await readFile(resolve(__dirname, '../../../.ai_context/seed-data.json'), 'utf8')) as Data;
  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const missions = new Map<string, string>();
    for (const item of data.missions) { const row = await tx.mission.upsert({ where: { name: item.name }, update: item, create: item }); missions.set(item.name, row.id); }
    const crew = new Map<string, string>();
    for (const item of data.crewMembers) { const missionId = missions.get(item.mission); if (!missionId) throw new Error(`Unknown mission: ${item.mission}`); const old = await tx.crewMember.findFirst({ where: { missionId, name: item.name } }); const row = old ? await tx.crewMember.update({ where: { id: old.id }, data: { role: item.role, age: item.age, status: item.status } }) : await tx.crewMember.create({ data: { missionId, name: item.name, role: item.role, age: item.age, status: item.status } }); crew.set(item.name, row.id); }
    for (const item of data.baselines) { const crewMemberId = crew.get(item.crew); if (!crewMemberId) throw new Error(`Unknown crew member: ${item.crew}`); const old = await tx.individualBaseline.findFirst({ where: { crewMemberId, zone: item.zone } }); if (old) await tx.individualBaseline.update({ where: { id: old.id }, data: { baselineData: item.baselineData } }); else await tx.individualBaseline.create({ data: { crewMemberId, zone: item.zone, baselineData: item.baselineData } }); }
    for (const item of data.healthRecords) { const crewMemberId = crew.get(item.crew); if (!crewMemberId) throw new Error(`Unknown crew member: ${item.crew}`); const old = await tx.healthRecord.findFirst({ where: { crewMemberId, sourceType: item.sourceType, zone: item.zone } }); if (old) await tx.healthRecord.update({ where: { id: old.id }, data: { metrics: item.metrics, symptoms: item.symptoms, isOutdated: item.isOutdated } }); else await tx.healthRecord.create({ data: { crewMemberId, sourceType: item.sourceType, zone: item.zone, metrics: item.metrics, symptoms: item.symptoms, isOutdated: item.isOutdated } }); }
    for (const item of data.environmentRecords) { const missionId = missions.get(item.mission); if (!missionId) throw new Error(`Unknown mission: ${item.mission}`); const old = await tx.environmentRecord.findFirst({ where: { missionId, radiationCans: item.radiationCans, totalRadiation: item.totalRadiation } }); if (!old) await tx.environmentRecord.create({ data: { missionId, radiationCans: item.radiationCans, totalRadiation: item.totalRadiation, pO2: item.pO2, co2Ppm: item.co2Ppm, cabinPressure: item.cabinPressure, temperature: item.temperature, humidity: item.humidity } }); }
    for (const item of data.alerts) { const missionId = missions.get(item.mission); const crewMemberId = item.crew ? crew.get(item.crew) : undefined; if (!missionId) throw new Error(`Unknown mission: ${item.mission}`); const old = await tx.alert.findFirst({ where: { missionId, title: item.title } }); const values = { missionId, crewMemberId, hazardType: item.hazardType, severity: item.severity, title: item.title, message: item.message, isResolved: item.isResolved }; if (old) await tx.alert.update({ where: { id: old.id }, data: values }); else await tx.alert.create({ data: values }); }
    for (const item of data.countermeasureProtocols) await tx.countermeasureProtocol.upsert({ where: { title: item.title }, update: { hazard: item.hazard, description: item.description, steps: item.steps }, create: item });
  });
  console.log('Seed completed successfully.');
}
main().catch((error) => { console.error('Seed failed:', error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
