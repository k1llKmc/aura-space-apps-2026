require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const { CrewService } = require('../dist/modules/crew/crew.service');

test('PostgreSQL: concurrent submissions, durable replay, UTC streak and health projection',
  { skip: !process.env.AURA_TEST_DATABASE_URL }, async () => {
    const url = process.env.AURA_TEST_DATABASE_URL;
    let prisma = new PrismaClient({ datasourceUrl: url });
    const missionId = randomUUID();
    const crewId = randomUUID();
    try {
      await prisma.mission.create({ data: { id: missionId, name: `crew-test-${missionId}`,
        destination: 'Test', phase: 'Test', missionDay: 1, commDelaySeconds: 0,
        crewMembers: { create: { id: crewId, name: 'Test', role: 'Commander', age: 40 } } } });
      let service = new CrewService(prisma);
      const empty = await service.getHealth(crewId);
      assert.equal(empty.zones.length, 5);
      assert.equal(empty.overallStatus, 'OUTDATED');
      assert.ok(empty.zones.every((zone) => zone.dataState === 'MISSING'));
      const yesterday = new Date();
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      await prisma.dailyHealthCheck.create({ data: { crewMemberId: crewId, checkDate: yesterday.toISOString().slice(0, 10),
        idempotencyKey: randomUUID(), payload: {}, response: {}, xpEarned: 50, currentStreak: 1 } });
      const payload = { crewMemberId: crewId, sourceType: 'MANUAL_REPORT', moodScore: 8,
        stressScore: 3, fatigueScore: 4, sleepHours: 7.5, symptoms: [], notes: '' };
      const key = randomUUID();
      const results = await Promise.all(Array.from({ length: 4 }, () => service.submitCheck(payload, key)));
      assert.equal(results.filter((result) => !result.replay).length, 1);
      assert.ok(results.every((result) => result.body.checkId === results[0].body.checkId));
      assert.equal(results[0].body.currentStreak, 2);
      assert.equal(await prisma.healthRecord.count({ where: { crewMemberId: crewId } }), 1);
      assert.equal(await prisma.dailyHealthCheck.count({ where: { crewMemberId: crewId } }), 2);
      await assert.rejects(service.submitCheck(payload, randomUUID()), { status: 409 });
      await assert.rejects(service.submitCheck({ ...payload, notes: 'changed' }, key), { status: 409 });
      // Force a new client and service instance: replay must survive process state loss.
      await prisma.$disconnect();
      prisma = new PrismaClient({ datasourceUrl: url });
      service = new CrewService(prisma);
      assert.deepEqual((await service.submitCheck(payload, key)).body, results[0].body);
      const afterCheck = await service.getHealth(crewId);
      assert.ok(afterCheck.zones.every((zone) => zone.dataState === 'MISSING'));
      const now = new Date();
      await prisma.healthRecord.createMany({ data: [
        { crewMemberId: crewId, sourceType: 'DIAGNOSTIC_DEVICE', zone: 'HEAD_EYES', metrics: { value: 1 }, symptoms: [], recordedAt: new Date(now - 8 * 86400000) },
        { crewMemberId: crewId, sourceType: 'AUTO_TELEMETRY', zone: 'CHEST_CARDIO', metrics: { value: 2 }, symptoms: [], recordedAt: now },
        { crewMemberId: crewId, sourceType: 'DIAGNOSTIC_DEVICE', zone: 'HEAD_EYES', metrics: { value: 999 }, symptoms: [], recordedAt: new Date(now.getTime() + 86400000) },
      ] });
      const alert = await prisma.alert.create({ data: { missionId, crewMemberId: crewId,
        hazardType: 'ALTERED_GRAVITY', severity: 'CRITICAL', title: 'Test', message: 'Test' } });
      let profile = await service.getHealth(crewId);
      assert.equal(profile.overallStatus, 'CRITICAL');
      assert.equal(profile.hasOutdatedData, true);
      assert.equal(profile.zones[0].dataState, 'STALE');
      assert.deepEqual(profile.zones[0].metrics, { value: 1 });
      assert.equal(profile.zones[1].dataState, 'CURRENT');
      await prisma.alert.update({ where: { id: alert.id }, data: { isResolved: true } });
      profile = await service.getHealth(crewId);
      assert.equal(profile.overallStatus, 'OUTDATED');
      // Distinct keys racing for another crew/date must also produce one winner.
      const otherId = randomUUID();
      await prisma.crewMember.create({ data: { id: otherId, missionId, name: 'Other', role: 'Crew', age: 30 } });
      const racing = await Promise.allSettled(Array.from({ length: 4 }, () => service.submitCheck({ ...payload, crewMemberId: otherId }, randomUUID())));
      assert.equal(racing.filter((result) => result.status === 'fulfilled').length, 1);
      assert.ok(racing.filter((result) => result.status === 'rejected').every((result) => result.reason.status === 409));
      assert.equal(await prisma.healthRecord.count({ where: { crewMemberId: otherId } }), 1);
    } finally {
      await prisma.mission.deleteMany({ where: { id: missionId } });
      await prisma.$disconnect();
    }
  });
