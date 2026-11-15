require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const { NestFactory } = require('@nestjs/core');
const { JwtService } = require('@nestjs/jwt');
const { hashPassword } = require('../dist/modules/auth/password');
const { AppModule } = require('../dist/app.module');
const { HttpExceptionFilter } = require('../dist/common/filters/http-exception.filter');

test('JWT and mission access: full HTTP role matrix against PostgreSQL',
  { skip: !process.env.AURA_TEST_DATABASE_URL }, async () => {
    process.env.DATABASE_URL = process.env.AURA_TEST_DATABASE_URL;
    process.env.JWT_SECRET = 'isolated-test-secret-never-used-in-production-123456789';
    const prisma = new PrismaClient({ datasourceUrl: process.env.AURA_TEST_DATABASE_URL });
    const missionIds = [randomUUID(), randomUUID()];
    const crewIds = [randomUUID(), randomUUID(), randomUUID()];
    const prefix = randomUUID().slice(0, 8);
    const password = 'strong-test-password-2026';
    let app;
    try {
      for (const [index, id] of missionIds.entries()) {
        await prisma.mission.create({ data: { id, name: `auth-test-${id}`, destination: 'Test', phase: 'Test', missionDay: 1, commDelaySeconds: 0,
          environmentLogs: { create: { radiationCans: 0, totalRadiation: 0, pO2: 21, co2Ppm: 400, cabinPressure: 101, temperature: 22, humidity: 45 } },
          crewMembers: { create: (index === 0 ? crewIds.slice(0, 2) : crewIds.slice(2)).map((id) => ({ id, name: `Crew ${id}`, role: 'Test', age: 30 })) } } });
      }
      const hash = await hashPassword(password);
      const accounts = {};
      for (const role of ['COMMANDER', 'MEDICAL_OFFICER', 'CREW_MEMBER']) {
        accounts[role] = await prisma.user.create({ data: { username: `${prefix}-${role.toLowerCase()}`, passwordHash: hash,
          role, missionId: missionIds[0], crewMemberId: role === 'CREW_MEMBER' ? crewIds[0] : null } });
      }
      const alertIds = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
      for (let i = 0; i < 4; i++) await prisma.alert.create({ data: { id: alertIds[i], missionId: i === 3 ? missionIds[1] : missionIds[0],
        crewMemberId: i === 0 ? null : crewIds[i - 1], hazardType: 'ALTERED_GRAVITY', severity: 'CRITICAL', title: `Alert ${i}`, message: 'Test' } });
      app = await NestFactory.create(AppModule, { logger: false });
      app.setGlobalPrefix('api/v1'); app.useGlobalFilters(new HttpExceptionFilter());
      await app.listen(0, '127.0.0.1');
      const base = `${await app.getUrl()}/api/v1`;
      async function call(path, token, body, method = body ? 'POST' : 'GET', extraHeaders = {}) {
        const response = await fetch(`${base}${path}`, { method, headers: { 'content-type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extraHeaders }, ...(body ? { body: JSON.stringify(body) } : {}) });
        return { status: response.status, body: await response.json() };
      }
      for (const path of ['/crew', '/missions/current', '/alerts', '/protocols', '/auth/me']) {
        const result = await call(path); assert.equal(result.status, 401); assert.equal(result.body.error, 'Unauthorized');
      }
      assert.equal((await call('/health')).status, 200);
      assert.equal((await call('/auth/login', null, { username: 'unknown', password })).status, 401);
      assert.equal((await call('/auth/login', null, { username: accounts.COMMANDER.username, password: 'wrong-password-1234' })).status, 401);
      const tokens = {};
      for (const [role, user] of Object.entries(accounts)) {
        const result = await call('/auth/login', null, { username: user.username, password });
        assert.equal(result.status, 200); assert.equal(result.body.expiresIn, 900);
        assert.equal(result.body.user.passwordHash, undefined); tokens[role] = result.body.accessToken;
      }
      const commander = tokens.COMMANDER, medic = tokens.MEDICAL_OFFICER, crew = tokens.CREW_MEMBER;
      assert.equal((await call('/auth/me', `${commander}bad`)).status, 401);
      const expired = new JwtService({ secret: process.env.JWT_SECRET }).sign({ sub: accounts.COMMANDER.id, ver: 0 }, { issuer: 'aura-api', audience: 'aura-client', expiresIn: -1 });
      assert.equal((await call('/auth/me', expired)).status, 401);
      for (const token of [commander, medic, crew]) {
        const mission = await call('/missions/current', token);
        assert.equal(mission.status, 200); assert.equal(mission.body.missionId, missionIds[0]);
        assert.equal((await call(`/crew/${crewIds[0]}/health`, token)).status, 200);
        assert.equal((await call(`/crew/${crewIds[2]}/health`, token)).status, 403);
      }
      assert.equal((await call(`/crew/${crewIds[1]}/health`, crew)).status, 403);
      assert.equal((await call(`/crew/${crewIds[1]}/health`, medic)).status, 200);
      assert.equal((await call('/crew', commander)).body.total, 2);
      const ownCrew = await call('/crew', crew);
      assert.equal(ownCrew.body.total, 1); assert.equal(ownCrew.body.items[0].id, crewIds[0]);
      assert.equal(ownCrew.body.items[0].age, undefined);
      assert.equal((await call('/crew?limit=101', crew)).status, 400);
      const alerts = await call('/alerts', crew);
      assert.deepEqual(new Set(alerts.body.items.map((a) => a.id)), new Set(alertIds.slice(0, 2)));
      assert.equal((await call('/alerts?isResolved=garbage', medic)).status, 400);
      assert.equal((await call(`/alerts/${alertIds[1]}/resolve`, crew, { note: 'Done' }, 'PATCH')).status, 403);
      assert.equal((await call(`/alerts/${alertIds[3]}/resolve`, commander, { note: 'Done' }, 'PATCH')).status, 404);
      const resolved = await call(`/alerts/${alertIds[1]}/resolve`, medic, { note: 'Reviewed' }, 'PATCH');
      assert.equal(resolved.status, 200); assert.equal(resolved.body.resolvedById, accounts.MEDICAL_OFFICER.id);
      const repeated = await call(`/alerts/${alertIds[1]}/resolve`, commander, { note: 'Other' }, 'PATCH');
      assert.equal(repeated.body.resolutionNote, 'Reviewed'); assert.equal(repeated.body.resolvedAt, resolved.body.resolvedAt);
      assert.equal((await call('/alerts?isResolved=true', medic)).body.total, 1);
      assert.equal((await call('/protocols?hazard=invalid', crew)).status, 400);
      assert.equal((await call('/protocols', crew)).status, 200);
      const newUsername = `${prefix}-new`;
      assert.equal((await call('/auth/users', medic, { username: newUsername, password, role: 'COMMANDER' })).status, 403);
      assert.equal((await call('/auth/users', commander, { username: newUsername, password, role: 'CREW_MEMBER' })).status, 400);
      assert.equal((await call('/auth/users', commander, { username: newUsername, password, role: 'CREW_MEMBER', crewMemberId: crewIds[2] })).status, 403);
      assert.equal((await call('/auth/users', commander, { username: newUsername, password, role: 'CREW_MEMBER', crewMemberId: crewIds[1] })).status, 201);
      const check = { crewMemberId: crewIds[1], sourceType: 'MANUAL_REPORT', moodScore: 8, stressScore: 3, fatigueScore: 4, sleepHours: 8, symptoms: [], notes: '' };
      const key = randomUUID(), headers = { 'Idempotency-Key': key };
      assert.equal((await call('/crew/checks', medic, check, 'POST', headers)).status, 201);
      assert.equal((await call('/crew/checks', crew, check, 'POST', headers)).status, 403); // Before replay lookup.
      assert.equal((await call('/crew/checks', commander, check, 'POST', headers)).status, 200);
      await prisma.user.update({ where: { id: accounts.MEDICAL_OFFICER.id }, data: { disabled: true } });
      assert.equal((await call('/auth/me', medic)).status, 401);
      assert.equal((await call('/auth/logout', commander, {}, 'POST')).status, 200);
      assert.equal((await call('/auth/me', commander)).status, 401);
      // Rate limit is enforced even when requests are malformed.
      let throttled = false;
      for (let i = 0; i < 21; i++) if ((await call('/auth/login', null, {})).status === 429) { throttled = true; break; }
      assert.equal(throttled, true);
    } finally {
      if (app) await app.close();
      await prisma.mission.deleteMany({ where: { id: { in: missionIds } } });
      await prisma.$disconnect();
    }
  });
