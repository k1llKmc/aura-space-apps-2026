require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { NestFactory } = require('@nestjs/core');
const { PrismaClient } = require('@prisma/client');
const { AppModule } = require('../dist/app.module');
const { HealthMonitor } = require('../dist/modules/crew/health-monitor.service');
const { hashPassword } = require('../dist/modules/auth/password');
const { HttpExceptionFilter } = require('../dist/common/filters/http-exception.filter');

test('health lifecycle: versioned baseline, evidence, history, alert episodes and scoped audit',
  { skip: !process.env.AURA_TEST_DATABASE_URL }, async () => {
    process.env.DATABASE_URL = process.env.AURA_TEST_DATABASE_URL;
    process.env.JWT_SECRET = 'health-isolated-test-secret-12345678901234567890';
    process.env.HEALTH_SWEEP_ENABLED = 'false';
    process.env.TASK_QUEUE_ENABLED = 'false';
    const prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });
    const missionId = randomUUID(), crewId = randomUUID(), otherId = randomUUID();
    const username = `medical-${randomUUID().slice(0, 8)}`, password = 'health-test-password-1234';
    let app;
    try {
      await prisma.mission.create({ data: { id: missionId, name: missionId, destination: 'Test', phase: 'Test', missionDay: 1, commDelaySeconds: 0,
        crewMembers: { create: [{ id: crewId, name: 'Test', role: 'Test', age: 30 }, { id: otherId, name: 'Other', role: 'Test', age: 30 }] } } });
      const passwordHash = await hashPassword(password);
      const operator = await prisma.user.create({ data: { username, passwordHash, role: 'MEDICAL_OFFICER', missionId } });
      await prisma.user.create({ data: { username: `${username}-crew`, passwordHash, role: 'CREW_MEMBER', missionId, crewMemberId: crewId } });
      app = await NestFactory.create(AppModule, { logger: false });
      app.setGlobalPrefix('api/v1'); app.useGlobalFilters(new HttpExceptionFilter());
      await app.listen(0, '127.0.0.1');
      const base = `${await app.getUrl()}/api/v1`;
      const monitor = app.get(HealthMonitor);
      async function call(path, token, body, method = body ? 'POST' : 'GET') {
        const response = await fetch(`${base}${path}`, { method, headers: { 'content-type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
        return { status: response.status, body: await response.json() };
      }
      const token = (await call('/auth/login', null, { username, password })).body.accessToken;
      const crewToken = (await call('/auth/login', null, { username: `${username}-crew`, password })).body.accessToken;
      const root = `/crew/${crewId}`;
      const policy = { zone: 'HEAD_EYES', reason: 'Synthetic test thresholds, not clinical limits', rules: [{ metric: 'intraocularPressure', unit: 'mmHg', baseline: 100,
        comparison: 'PERCENT', direction: 'INCREASE', attentionDelta: 5, criticalDelta: 10, allowedSources: ['DIAGNOSTIC_DEVICE'] }] };
      assert.equal((await call(`${root}/baselines`, crewToken, policy)).status, 403);
      assert.equal((await call('/crew/health/rules-catalog', token)).status, 200);
      assert.equal((await call(`${root}/baselines`, token, { ...policy, rules: [{ ...policy.rules[0], unit: 'incorrect' }] })).status, 400);
      const baseline = await call(`${root}/baselines`, token, policy);
      assert.equal(baseline.status, 201);
      await monitor.reconcileCrew(crewId);
      let profile = (await call(`${root}/health`, token)).body;
      assert.equal(profile.zones[0].dataState, 'MISSING'); assert.equal(profile.zones[0].riskStatus, null);
      const count = await prisma.alert.count({ where: { crewMemberId: crewId } });
      await Promise.all([monitor.reconcileCrew(crewId), monitor.reconcileCrew(crewId)]);
      assert.equal(await prisma.alert.count({ where: { crewMemberId: crewId } }), count);
      const record = { zone: 'HEAD_EYES', sourceType: 'DIAGNOSTIC_DEVICE', metrics: { intraocularPressure: 112 }, units: { intraocularPressure: 'mmHg' }, symptoms: [] };
      assert.equal((await call(`${root}/records`, crewToken, record)).status, 403);
      assert.equal((await call(`${root}/records`, token, { ...record, recordedAt: new Date(Date.now() + 86400000).toISOString() })).status, 400);
      const created = await call(`${root}/records`, token, record);
      assert.equal(created.status, 201);
      await monitor.reconcileCrew(crewId);
      profile = (await call(`${root}/health`, token)).body;
      assert.equal(profile.zones[0].riskStatus, 'CRITICAL'); assert.equal(profile.zones[0].dataState, 'CURRENT');
      assert.equal(profile.zones[0].baselineId, baseline.body.id); assert.equal(profile.zones[0].evidence[0].delta, 12);
      const risk = await prisma.alert.findFirst({ where: { crewMemberId: crewId, origin: 'HEALTH_RISK', isResolved: false } });
      assert.ok(risk);
      await call(`/alerts/${risk.id}/resolve`, token, { note: 'Reviewed synthetic deviation' }, 'PATCH');
      await monitor.reconcileCrew(crewId);
      assert.equal((await prisma.alert.findUnique({ where: { id: risk.id } })).isResolved, true);
      assert.equal((await call(`${root}/health`, token)).body.zones[0].riskStatus, 'CRITICAL');
      // A new reference version is re-applied to the same record and is immutable.
      const changed = await call(`${root}/baselines`, token, { ...policy, rules: [{ ...policy.rules[0], baseline: 112 }] });
      assert.equal(changed.status, 201);
      await monitor.reconcileCrew(crewId);
      profile = (await call(`${root}/health`, token)).body;
      assert.equal(profile.zones[0].riskStatus, 'NOMINAL'); assert.equal(profile.zones[0].baselineId, changed.body.id);
      assert.equal((await call(`${root}/baselines`, token)).body.total, 2);
      // Cached flag is recalculated from recordedAt, never trusted as risk evidence.
      await prisma.healthRecord.update({ where: { id: created.body.id }, data: { recordedAt: new Date(Date.now() - 8 * 86400000), isOutdated: false } });
      await monitor.reconcileCrew(crewId);
      profile = (await call(`${root}/health`, token)).body;
      assert.equal(profile.zones[0].riskStatus, 'NOMINAL'); assert.equal(profile.zones[0].dataState, 'STALE');
      assert.equal((await prisma.healthRecord.findUnique({ where: { id: created.body.id } })).isOutdated, true);
      const stale = await prisma.alert.findFirst({ where: { crewMemberId: crewId, zone: 'HEAD_EYES', origin: 'DATA_FRESHNESS', isResolved: false } });
      assert.ok(stale);
      await call(`${root}/records`, token, { ...record, metrics: { intraocularPressure: 112 } });
      await monitor.reconcileCrew(crewId);
      assert.equal((await prisma.alert.findUnique({ where: { id: stale.id } })).isResolved, true);
      const history = await call(`${root}/records?limit=1&zone=HEAD_EYES`, crewToken);
      assert.equal(history.body.total, 2); assert.equal(history.body.items.length, 1);
      assert.equal((await call(`${root}/records?from=2026-12-01T00:00:00Z&to=2026-01-01T00:00:00Z`, token)).status, 400);
      assert.equal((await call(`/crew/${otherId}/records`, crewToken)).status, 403);
      const events = (await call(`/audit?crewMemberId=${crewId}&limit=100`, token)).body;
      for (const action of ['BASELINE_SET', 'HEALTH_RECORD_CREATED', 'HEALTH_STATE_CHANGED', 'ALERT_GENERATED', 'ALERT_RESOLVED', 'ALERT_AUTO_RESOLVED']) assert.ok(events.items.some((item) => item.action === action), action);
      assert.ok(events.items.some((item) => item.actorId === operator.id && item.actorUsername === username));
      assert.ok(!JSON.stringify(events).includes(passwordHash));
      const ownAudit = (await call('/audit', crewToken)).body;
      assert.ok(ownAudit.items.every((item) => item.crewMemberId === crewId));
      assert.equal((await call(`/audit?crewMemberId=${otherId}`, crewToken)).status, 403);
      // Repeated stable evaluations do not flood the change journal.
      const before = await prisma.auditEvent.count({ where: { crewMemberId: crewId, action: 'HEALTH_STATE_CHANGED' } });
      await monitor.reconcileCrew(crewId);
      assert.equal(await prisma.auditEvent.count({ where: { crewMemberId: crewId, action: 'HEALTH_STATE_CHANGED' } }), before);
    } finally {
      if (app) await app.close();
      await prisma.mission.deleteMany({ where: { id: missionId } });
      await prisma.$disconnect();
    }
  });
