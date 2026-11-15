const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const base = process.env.WORKER_SMOKE_API_URL || 'http://127.0.0.1:3001/api/v1';
(async () => {
  let crew;
  let token;
  try {
    const login = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: process.env.AUTH_BOOTSTRAP_USERNAME || 'commander', password: process.env.AUTH_BOOTSTRAP_PASSWORD }) });
    assert.equal(login.status, 200);
    const session = await login.json(); token = session.accessToken;
    const headers = { 'content-type': 'application/json', authorization: `Bearer ${token}` };
    crew = await prisma.crewMember.create({ data: { missionId: session.user.missionId, name: `Worker smoke ${randomUUID()}`, role: 'Synthetic test', age: 30 } });
    await prisma.individualBaseline.create({ data: { crewMemberId: crew.id, zone: 'HEAD_EYES', baselineData: { schemaVersion: 1, rules: [{
      metric: 'intraocularPressure', unit: 'mmHg', baseline: 100, comparison: 'PERCENT', direction: 'BOTH', attentionDelta: 5, criticalDelta: 10, allowedSources: ['AUTO_TELEMETRY'],
    }] } } });
    const payload = { eventId: randomUUID(), producerId: 'worker-smoke', recordedAt: new Date().toISOString(), kind: 'HEALTH', crewMemberId: crew.id,
      measurement: { zone: 'HEAD_EYES', sourceType: 'AUTO_TELEMETRY', metrics: { intraocularPressure: 112 }, units: { intraocularPressure: 'mmHg' }, symptoms: [] } };
    const accepted = await fetch(`${base}/telemetry`, { method: 'POST', headers, body: JSON.stringify(payload) });
    assert.equal(accepted.status, 202);
    const { jobId } = await accepted.json();
    let completed = false;
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) {
      const response = await fetch(`${base}/jobs/${jobId}`, { headers });
      assert.equal(response.status, 200);
      const task = await response.json();
      assert.notEqual(task.state, 'FAILED');
      if (task.state === 'COMPLETED') { completed = true; break; }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    assert.equal(completed, true);
    const duplicate = await fetch(`${base}/telemetry`, { method: 'POST', headers, body: JSON.stringify(payload) });
    assert.equal((await duplicate.json()).jobId, jobId);
    assert.equal(await prisma.healthRecord.count({ where: { crewMemberId: crew.id } }), 1);
    const health = await (await fetch(`${base}/crew/${crew.id}/health`, { headers })).json();
    assert.equal(health.zones[0].riskStatus, 'CRITICAL'); assert.equal(health.zones[0].dataState, 'CURRENT');
    assert.ok(await prisma.alert.count({ where: { crewMemberId: crew.id, origin: 'HEALTH_RISK' } }));
    console.log('Worker smoke passed: proxy -> API -> PostgreSQL/outbox -> Redis -> worker -> measurement and warning.');
  } finally {
    if (crew) await prisma.crewMember.delete({ where: { id: crew.id } });
    if (token) await fetch(`${base}/auth/logout`, { method: 'POST', headers: { authorization: `Bearer ${token}` } }).catch(() => {});
    await prisma.$disconnect();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
