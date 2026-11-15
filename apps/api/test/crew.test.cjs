require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Module } = require('@nestjs/common');
const { NestFactory } = require('@nestjs/core');
const { CrewController } = require('../dist/modules/crew/crew.controller');
const { CrewService } = require('../dist/modules/crew/crew.service');
const { AuthService } = require('../dist/modules/auth/auth.service');
const { HttpExceptionFilter } = require('../dist/common/filters/http-exception.filter');
const { dailyHealthCheckSchema } = require('../dist/modules/crew/crew.contracts');
const { zoneHealth, overallStatus, streakForDate } = require('../dist/modules/crew/crew.health');

const crewId = randomUUID();
const payload = { crewMemberId: crewId, sourceType: 'MANUAL_REPORT', moodScore: 8,
  stressScore: 3, fatigueScore: 4, sleepHours: 7.5, symptoms: [], notes: '' };

test('strict input boundaries, whitespace normalization and source provenance', () => {
  assert.equal(dailyHealthCheckSchema.parse({ ...payload, notes: ' hello ' }).notes, 'hello');
  for (const patch of [{ moodScore: 0 }, { stressScore: 11 }, { fatigueScore: 1.2 },
    { sleepHours: 25 }, { sleepHours: '8' }, { sleepHours: Infinity }, { sourceType: 'AUTO_TELEMETRY' },
    { symptoms: ['Fatigue', ' Fatigue '] }, { symptoms: [' '] }, { notes: 'x'.repeat(2001) }, { extra: true }]) {
    assert.equal(dailyHealthCheckSchema.safeParse({ ...payload, ...patch }).success, false, JSON.stringify(patch));
  }
  assert.equal(dailyHealthCheckSchema.safeParse({ ...payload, sleepHours: 0, moodScore: 1, stressScore: 10 }).success, true);
});

test('freshness boundary, missing data and unknown assessment are independent', () => {
  const now = new Date('2026-11-15T12:00:00Z');
  const record = { recordedAt: new Date(now.getTime() - 7 * 86400000), sourceType: 'DIAGNOSTIC_DEVICE', metrics: { hr: 60 }, isOutdated: true };
  const zone = zoneHealth('CHEST_CARDIO', record, now);
  assert.equal(zone.dataState, 'CURRENT');
  assert.equal(zone.isOutdated, false);
  assert.equal(zone.riskStatus, null);
  assert.equal(zone.status, 'OUTDATED');
  assert.equal(zoneHealth('CHEST_CARDIO', record, new Date(now.getTime() + 1)).dataState, 'STALE');
  const missing = zoneHealth('HEAD_EYES', undefined, now);
  assert.equal(missing.dataState, 'MISSING');
  assert.equal(missing.lastChecked, null);
  assert.equal(missing.metrics, null);
  assert.equal(overallStatus(['OUTDATED', 'CRITICAL']), 'CRITICAL');
  assert.equal(overallStatus(['OUTDATED', 'ATTENTION']), 'ATTENTION');
});

test('streak respects UTC dates, gaps and year boundary', () => {
  assert.equal(streakForDate('2027-01-01', ['2026-12-31', '2026-12-30']), 3);
  assert.equal(streakForDate('2027-01-01', ['2026-12-30']), 1);
  assert.equal(streakForDate('2027-01-01', []), 1);
});

test('profile includes five zones, aggregates alerts without assigning a zone', async () => {
  let query;
  const service = new CrewService({ crewMember: { findUnique: async (args) => {
    query = args;
    return { id: crewId, name: 'Test', role: 'Commander', healthRecords: [], alerts: [{ severity: 'CRITICAL' }] };
  } } });
  const result = await service.getHealth(crewId);
  assert.equal(result.zones.length, 5);
  assert.equal(result.overallStatus, 'CRITICAL');
  assert.equal(result.hasOutdatedData, true);
  assert.ok(result.zones.every((zone) => zone.riskStatus === null));
  assert.deepEqual(query.include.alerts.where, { isResolved: false });
  assert.ok(query.include.healthRecords.where.recordedAt.lte instanceof Date);
  await assert.rejects(new CrewService({ crewMember: { findUnique: async () => null } }).getHealth(crewId), { status: 404 });
});

function memoryService() {
  const checks = [];
  const healthRecords = [];
  const tx = {
    crewMember: { findUnique: async () => ({ id: crewId }) },
    dailyHealthCheck: {
      findUnique: async ({ where }) => checks.find((item) => item.idempotencyKey === where.crewMemberId_idempotencyKey.idempotencyKey) ?? null,
      findMany: async () => checks,
      create: async ({ data }) => { checks.push(data); return data; },
    },
    healthRecord: { create: async ({ data }) => { healthRecords.push(data); return data; } },
  };
  return { service: new CrewService({ $transaction: async (fn) => fn(tx) }), checks, healthRecords };
}

test('daily check replay persists original response and never repeats XP or diagnostic writes', async () => {
  const { service, checks, healthRecords } = memoryService();
  const key = randomUUID();
  const first = await service.submitCheck(payload, key);
  assert.equal(first.replay, false);
  assert.equal(first.body.currentStreak, 1);
  assert.equal(first.body.xpEarned, 50);
  const replay = await service.submitCheck(payload, key);
  assert.equal(replay.replay, true);
  assert.deepEqual(replay.body, first.body);
  assert.equal(checks.length, 1);
  assert.equal(healthRecords.length, 1);
  assert.equal(healthRecords[0].zone, null);
  await assert.rejects(service.submitCheck({ ...payload, moodScore: 7 }, key), { status: 409 });
  await assert.rejects(service.submitCheck(payload, randomUUID()), { status: 409 });
});

test('HTTP routing, validation, error envelope, initial 201 and replay 200', async () => {
  const { service } = memoryService();
  class TestModule {}
  Module({ controllers: [CrewController], providers: [{ provide: CrewService, useValue: service },
    { provide: AuthService, useValue: { requireCrew: async () => {} } }] })(TestModule);
  const app = await NestFactory.create(TestModule, { logger: false });
  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.listen(0, '127.0.0.1');
  try {
    const base = await app.getUrl();
    const bad = await fetch(`${base}/api/v1/crew/invalid/health`);
    assert.equal(bad.status, 400);
    const error = await bad.json();
    assert.equal(error.error, 'Bad Request');
    assert.ok(Array.isArray(error.message));
    assert.ok(error.timestamp);
    const send = (key) => fetch(`${base}/api/v1/crew/checks`, { method: 'POST',
      headers: { 'content-type': 'application/json', ...(key ? { 'Idempotency-Key': key } : {}) }, body: JSON.stringify(payload) });
    assert.equal((await send()).status, 400);
    const key = randomUUID();
    const first = await send(key);
    assert.equal(first.status, 201);
    const result = await first.json();
    const replay = await send(key);
    assert.equal(replay.status, 200);
    assert.deepEqual(await replay.json(), result);
    assert.equal((await send(randomUUID())).status, 409);
  } finally { await app.close(); }
});
