import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Prisma, PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();
const dataSourceTypeSchema = z.enum(['AUTO_TELEMETRY', 'MANUAL_REPORT', 'DIAGNOSTIC_DEVICE']);
const hazardTypeSchema = z.enum(['SPACE_RADIATION', 'ALTERED_GRAVITY', 'ISOLATION_CONFINEMENT', 'DISTANCE_FROM_EARTH', 'HOSTILE_ENVIRONMENT']);
const alertSeveritySchema = z.enum(['NOMINAL', 'ATTENTION', 'CRITICAL', 'OUTDATED']);
const bodyZoneSchema = z.enum(['HEAD_EYES', 'CHEST_CARDIO', 'ABDOMEN_METABOLISM', 'WHOLE_BODY_IMMUNE', 'SKELETON_MUSCLES']);
const jsonObjectSchema = z.record(z.unknown());
const seedDataSchema = z.object({
  missions: z.array(z.object({ name: z.string().min(1), destination: z.string().min(1), phase: z.string().min(1), missionDay: z.number().int().nonnegative(), commDelaySeconds: z.number().int().nonnegative(), isCurrent: z.boolean().optional() })).min(1),
  crewMembers: z.array(z.object({ mission: z.string().min(1), name: z.string().min(1), role: z.string().min(1), age: z.number().int().positive(), status: alertSeveritySchema })),
  baselines: z.array(z.object({ crew: z.string().min(1), zone: bodyZoneSchema, baselineData: jsonObjectSchema })),
  healthRecords: z.array(z.object({ crew: z.string().min(1), sourceType: dataSourceTypeSchema, zone: bodyZoneSchema.nullable(), metrics: jsonObjectSchema, symptoms: z.array(z.string()), isOutdated: z.boolean() })),
  environmentRecords: z.array(z.object({ mission: z.string().min(1), radiationCans: z.number(), totalRadiation: z.number(), pO2: z.number(), co2Ppm: z.number(), cabinPressure: z.number(), temperature: z.number(), humidity: z.number() })),
  alerts: z.array(z.object({ mission: z.string().min(1), crew: z.string().min(1).optional(), hazardType: hazardTypeSchema, severity: alertSeveritySchema, title: z.string().min(1), message: z.string().min(1), isResolved: z.boolean() })),
  countermeasureProtocols: z.array(z.object({ title: z.string().min(1), hazard: hazardTypeSchema, description: z.string().min(1), steps: z.array(z.string().min(1)).min(1) })),
});

export type SeedData = z.infer<typeof seedDataSchema>;

async function resolveSeedFile(): Promise<string> {
  const candidates = ['../../../.ai_context/seed-data.json', '../../../.ai-context/seed-data.json'].map((path) => resolve(__dirname, path));
  for (const file of candidates) {
    try { await access(file); return file; } catch { /* Try the next supported context path. */ }
  }
  throw new Error(`Seed data file not found. Checked: ${candidates.join(', ')}`);
}

export async function loadSeedData(): Promise<SeedData> {
  const file = await resolveSeedFile();
  return seedDataSchema.parse(JSON.parse(await readFile(file, 'utf8')));
}

function requireId(values: Map<string, string>, key: string, kind: string): string {
  const id = values.get(key);
  if (!id) throw new Error(`Unknown ${kind}: ${key}`);
  return id;
}

export async function seedDatabase(data?: SeedData): Promise<void> {
  const seedData = data ?? await loadSeedData();
  const currentMission = seedData.missions.find((mission) => mission.isCurrent)?.name ?? 'Mars Transit 2026';
  if (!seedData.missions.some((mission) => mission.name === currentMission)) throw new Error(`Current mission is not present in seed data: ${currentMission}`);

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.mission.updateMany({ data: { isCurrent: false } });
    const missions = new Map<string, string>();
    for (const item of seedData.missions) {
      const values = { name: item.name, destination: item.destination, phase: item.phase, missionDay: item.missionDay, commDelaySeconds: item.commDelaySeconds, isCurrent: item.name === currentMission };
      const mission = await tx.mission.upsert({ where: { name: item.name }, update: values, create: values });
      missions.set(item.name, mission.id);
    }

    const crew = new Map<string, string>();
    for (const item of seedData.crewMembers) {
      const missionId = requireId(missions, item.mission, 'mission');
      const existing = await tx.crewMember.findFirst({ where: { missionId, name: item.name } });
      const values = { missionId, name: item.name, role: item.role, age: item.age, status: item.status };
      const member = existing ? await tx.crewMember.update({ where: { id: existing.id }, data: values }) : await tx.crewMember.create({ data: values });
      crew.set(item.name, member.id);
    }

    for (const item of seedData.baselines) {
      const crewMemberId = requireId(crew, item.crew, 'crew member');
      const existing = await tx.individualBaseline.findFirst({ where: { crewMemberId, zone: item.zone } });
      const values = { crewMemberId, zone: item.zone, baselineData: item.baselineData as Prisma.InputJsonValue };
      if (existing) await tx.individualBaseline.update({ where: { id: existing.id }, data: values }); else await tx.individualBaseline.create({ data: values });
    }

    for (const item of seedData.healthRecords) {
      const crewMemberId = requireId(crew, item.crew, 'crew member');
      const existing = await tx.healthRecord.findFirst({ where: { crewMemberId, sourceType: item.sourceType, zone: item.zone } });
      const values = { crewMemberId, sourceType: item.sourceType, zone: item.zone, metrics: item.metrics as Prisma.InputJsonValue, symptoms: item.symptoms, isOutdated: item.isOutdated };
      if (existing) await tx.healthRecord.update({ where: { id: existing.id }, data: values }); else await tx.healthRecord.create({ data: values });
    }

    for (const item of seedData.environmentRecords) {
      const missionId = requireId(missions, item.mission, 'mission');
      const existing = await tx.environmentRecord.findFirst({ where: { missionId, radiationCans: item.radiationCans, totalRadiation: item.totalRadiation } });
      if (!existing) await tx.environmentRecord.create({ data: { missionId, radiationCans: item.radiationCans, totalRadiation: item.totalRadiation, pO2: item.pO2, co2Ppm: item.co2Ppm, cabinPressure: item.cabinPressure, temperature: item.temperature, humidity: item.humidity } });
    }

    for (const item of seedData.alerts) {
      const missionId = requireId(missions, item.mission, 'mission');
      const crewMemberId = item.crew ? requireId(crew, item.crew, 'crew member') : null;
      const existing = await tx.alert.findFirst({ where: { missionId, title: item.title } });
      const values = { missionId, crewMemberId, hazardType: item.hazardType, severity: item.severity, title: item.title, message: item.message, isResolved: item.isResolved };
      if (existing) await tx.alert.update({ where: { id: existing.id }, data: values }); else await tx.alert.create({ data: values });
    }

    for (const item of seedData.countermeasureProtocols) {
      await tx.countermeasureProtocol.upsert({ where: { title: item.title }, update: { hazard: item.hazard, description: item.description, steps: item.steps }, create: item });
    }
  });
}

async function main(): Promise<void> {
  await seedDatabase();
  console.log('Seed completed successfully.');
}

if (require.main === module) {
  main().catch((error: unknown) => { console.error('Seed failed:', error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
}
