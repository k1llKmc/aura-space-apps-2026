require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const { PrismaClient } = require('@prisma/client');
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/app.module');
const { WorkerModule } = require('../dist/worker.module');
const { TaskQueue } = require('../dist/modules/tasks/task-queue.service');
const { TaskProcessor } = require('../dist/modules/tasks/task-processor.service');
const { PrismaService } = require('../dist/prisma/prisma.service');
const { hashPassword } = require('../dist/modules/auth/password');
const { HttpExceptionFilter } = require('../dist/common/filters/http-exception.filter');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test('BullMQ: durable telemetry, provenance, retries, lost-job recovery, simulations and worker restart',
  { skip: !process.env.AURA_TEST_DATABASE_URL || !process.env.AURA_TEST_REDIS_URL, timeout: 120000 }, async () => {
    const url = new URL(process.env.AURA_TEST_DATABASE_URL);
    const schema = `queue_${randomUUID().replaceAll('-', '')}`;
    url.searchParams.set('schema', schema);
    Object.assign(process.env, { DATABASE_URL: url.toString(), DIRECT_URL: url.toString(), REDIS_URL: process.env.AURA_TEST_REDIS_URL,
      QUEUE_PREFIX: schema, TASK_QUEUE_ENABLED: 'true', HEALTH_SWEEP_ENABLED: 'true', HEALTH_SWEEP_INTERVAL_SECONDS: '10',
      JWT_SECRET: 'queue-fixture-secret-123456789012345678901234567890' });
    execFileSync(process.execPath, [path.resolve(__dirname, '../../../node_modules/prisma/build/index.js'), 'migrate', 'deploy', '--schema', path.resolve(__dirname, '../prisma/schema.prisma')], { env: process.env, stdio: 'pipe' });
    const prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });
    const missionId = randomUUID(), foreignMission = randomUUID(), crewId = randomUUID(), otherCrew = randomUUID();
    const password = 'queue-test-password-1234';
    let api, worker, queue;
    try {
      for (const [id, crew] of [[missionId, crewId], [foreignMission, otherCrew]]) await prisma.mission.create({ data: {
        id, name: id, destination: 'Test', phase: 'Test', missionDay: 1, commDelaySeconds: 0,
        crewMembers: { create: { id: crew, name: 'Test', role: 'Test', age: 30 } },
        environmentLogs: { create: { radiationCans: 0, totalRadiation: 0, pO2: 21, co2Ppm: 400, cabinPressure: 101, temperature: 22, humidity: 45, recordedAt: new Date(Date.now() - 60000) } },
      } });
      const passwordHash = await hashPassword(password);
      const users = {};
      for (const [username, role, mission, crew] of [['operator', 'COMMANDER', missionId, null], ['crew', 'CREW_MEMBER', missionId, crewId], ['foreign', 'COMMANDER', foreignMission, null]]) {
        users[username] = await prisma.user.create({ data: { username, passwordHash, role, missionId: mission, crewMemberId: crew } });
      }
      const baseline = await prisma.individualBaseline.create({ data: { crewMemberId: crewId, zone: 'HEAD_EYES', baselineData: { schemaVersion: 1, rules: [{
        metric: 'intraocularPressure', unit: 'mmHg', baseline: 100, comparison: 'PERCENT', direction: 'BOTH', attentionDelta: 5, criticalDelta: 10,
        allowedSources: ['AUTO_TELEMETRY', 'MANUAL_REPORT', 'DIAGNOSTIC_DEVICE'],
      }] } } });
      api = await NestFactory.create(AppModule, { logger: false });
      api.setGlobalPrefix('api/v1'); api.useGlobalFilters(new HttpExceptionFilter()); await api.listen(0, '127.0.0.1');
      queue = api.get(TaskQueue);
      const base = `${await api.getUrl()}/api/v1`;
      async function call(route, token, body, method = body ? 'POST' : 'GET', headers = {}) {
        const response = await fetch(`${base}${route}`, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) });
        return { status: response.status, body: await response.json() };
      }
      const operator = (await call('/auth/login', null, { username: 'operator', password })).body.accessToken;
      const crewToken = (await call('/auth/login', null, { username: 'crew', password })).body.accessToken;
      const foreign = (await call('/auth/login', null, { username: 'foreign', password })).body.accessToken;
      const measurement = { zone: 'HEAD_EYES', sourceType: 'DIAGNOSTIC_DEVICE', metrics: { intraocularPressure: 112 }, units: { intraocularPressure: 'mmHg' }, symptoms: [] };
      function event(sourceType = 'DIAGNOSTIC_DEVICE', target = crewId) {
        return { eventId: randomUUID(), producerId: 'fixture-device', kind: 'HEALTH', crewMemberId: target, recordedAt: new Date().toISOString(), measurement: { ...measurement, sourceType } };
      }
      assert.equal((await call('/telemetry', null, event())).status, 401);
      assert.equal((await call('/telemetry', crewToken, event('AUTO_TELEMETRY'))).status, 403);
      assert.equal((await call('/telemetry', operator, event('DIAGNOSTIC_DEVICE', otherCrew))).status, 403);
      assert.equal((await call('/telemetry', operator, { ...event(), recordedAt: new Date(Date.now() + 86400000).toISOString() })).status, 400);
      const original = event('AUTO_TELEMETRY');
      const accepted = await Promise.all([call('/telemetry', operator, original), call('/telemetry', operator, original)]);
      assert.ok(accepted.every((result) => result.status === 202));
      const firstId = accepted[0].body.jobId;
      assert.equal(firstId, accepted[1].body.jobId);
      assert.equal(await prisma.healthRecord.count({ where: { crewMemberId: crewId } }), 0, 'No API-side telemetry processing');
      assert.equal((await call('/telemetry', operator, { ...original, measurement: { ...measurement, metrics: { intraocularPressure: 120 } } })).status, 409);
      assert.equal((await call(`/jobs/${firstId}`, foreign)).status, 404);
      assert.equal((await call(`/jobs/${firstId}`, crewToken)).status, 404);
      const manual = await call('/telemetry', crewToken, event('MANUAL_REPORT'));
      const diagnostic = await call('/telemetry', operator, event());
      const environment = { eventId: randomUUID(), producerId: 'fixture-cabin', recordedAt: new Date().toISOString(), kind: 'ENVIRONMENT', sourceType: 'AUTO_TELEMETRY',
        metrics: { radiationCans: 1.99, totalRadiation: 4, pO2: 21, co2Ppm: 500, cabinPressure: 101, temperature: 23, humidity: 45 } };
      assert.equal((await call('/telemetry', crewToken, environment)).status, 403);
      const envTask = await call('/telemetry', operator, environment);
      const redisClient = await queue.queue.client;
      redisClient.disconnect(); await sleep(50);
      assert.equal((await call('/health')).status, 503);
      const offlineAccepted = await call('/telemetry', operator, event());
      assert.equal(offlineAccepted.status, 202, 'DB acceptance does not depend on the API Redis connection');
      assert.equal((await prisma.backgroundTask.findUnique({ where: { id: offlineAccepted.body.jobId } })).publishedAt, null);
      await redisClient.connect();
      async function startWorker() { return NestFactory.createApplicationContext(WorkerModule, { logger: false }); }
      async function wait(id, state = 'COMPLETED') {
        const deadline = Date.now() + 30000;
        while (Date.now() < deadline) {
          const result = await call(`/jobs/${id}`, operator);
          if (result.body.state === state) return result.body;
          if (result.body.state === 'FAILED' && state !== 'FAILED') assert.fail(`Task failed: ${result.body.errorCode}`);
          await sleep(100);
        }
        assert.fail(`Timed out waiting for ${state}`);
      }
      worker = await startWorker();
      assert.ok(await (await worker.get(TaskQueue).queue.client).get(`${schema}:worker:${require('node:os').hostname()}`));
      for (const id of [firstId, manual.body.jobId, diagnostic.body.jobId, envTask.body.jobId, offlineAccepted.body.jobId]) await wait(id);
      assert.equal(await prisma.healthRecord.count({ where: { crewMemberId: crewId } }), 4);
      assert.deepEqual(new Set((await prisma.healthRecord.findMany({ where: { crewMemberId: crewId } })).map((row) => row.sourceType)), new Set(['AUTO_TELEMETRY', 'MANUAL_REPORT', 'DIAGNOSTIC_DEVICE']));
      const mission = await call('/missions/current', operator);
      assert.equal(mission.body.environment.radiationCans, 1.99); assert.equal(mission.body.environment.sourceType, 'AUTO_TELEMETRY');
      assert.equal((await call(`/crew/${crewId}/health`, operator)).body.zones[0].riskStatus, 'CRITICAL');
      assert.ok(await prisma.alert.count({ where: { crewMemberId: crewId, origin: 'HEALTH_RISK' } }));
      const periodicDeadline = Date.now() + 15000;
      while (!await prisma.backgroundTask.count({ where: { kind: 'HEALTH_RECHECK', state: 'COMPLETED' } }) && Date.now() < periodicDeadline) await sleep(100);
      assert.ok(await prisma.backgroundTask.count({ where: { kind: 'HEALTH_RECHECK', state: 'COMPLETED' } }), 'Periodic BullMQ health scan executes');
      assert.ok(await prisma.alert.count({ where: { crewMemberId: otherCrew, origin: 'DATA_FRESHNESS' } }), 'Periodic checks generate missing-data warnings');
      const staleEvent = { ...event(), recordedAt: new Date(Date.now() - 8 * 86400000).toISOString() };
      const staleTask = await call('/telemetry', operator, staleEvent); await wait(staleTask.body.jobId);
      const staleRecord = await prisma.healthRecord.findUnique({ where: { id: staleTask.body.jobId } });
      assert.equal(staleRecord.isOutdated, true); assert.equal(staleRecord.recordedAt.toISOString(), staleEvent.recordedAt);

      // Fault after committing a measurement: the retry must not duplicate it or its audit.
      const retryEvent = event();
      const processor = worker.get(TaskProcessor), afterTelemetry = processor.afterTelemetry.bind(processor);
      let failOnce = true;
      processor.afterTelemetry = async (task, id) => {
        if (task.payload.eventId === retryEvent.eventId && failOnce) { failOnce = false; throw new Error('Injected transient evaluation failure'); }
        return afterTelemetry(task, id);
      };
      const retryTask = await call('/telemetry', operator, retryEvent);
      const recovered = await wait(retryTask.body.jobId);
      assert.equal(recovered.attempts, 2);
      const completedRedisJob = await queue.queue.getJob(`${recovered.jobId}-g0`);
      assert.deepEqual(completedRedisJob.returnvalue, { taskId: recovered.jobId });
      assert.equal(await prisma.healthRecord.count({ where: { id: recovered.jobId } }), 1);
      assert.equal(await prisma.auditEvent.count({ where: { entityId: recovered.jobId, action: 'TELEMETRY_RECORDED' } }), 1);

      const exhaustedEvent = event();
      let failuresLeft = 5;
      processor.afterTelemetry = async (task, id) => {
        if (task.payload.eventId === exhaustedEvent.eventId && failuresLeft-- > 0) throw new Error('Injected repeated evaluation failure');
        return afterTelemetry(task, id);
      };
      const exhausted = await call('/telemetry', operator, exhaustedEvent);
      const failedTask = await wait(exhausted.body.jobId, 'FAILED');
      assert.equal(failedTask.attempts, 5); assert.equal(failedTask.errorCode, 'PROCESSING_FAILED');
      assert.equal(await prisma.healthRecord.count({ where: { id: failedTask.jobId } }), 1);
      assert.equal(await prisma.auditEvent.count({ where: { entityId: failedTask.jobId, action: 'TASK_FAILED' } }), 1);
      assert.equal((await call(`/jobs/${failedTask.jobId}/retry`, operator, {})).status, 202);
      assert.equal((await wait(failedTask.jobId)).attempts, 6);
      assert.equal(await prisma.healthRecord.count({ where: { id: failedTask.jobId } }), 1);

      // Pause all consumers. Acceptance survives a lost Redis job via the DB outbox.
      await worker.close(); worker = undefined;
      const lost = await call('/telemetry', operator, event());
      const redisJob = await queue.queue.getJob(`${lost.body.jobId}-g0`);
      assert.deepEqual(Object.keys(redisJob.data).sort(), ['generation', 'taskId']);
      await redisJob.remove();
      await prisma.backgroundTask.update({ where: { id: lost.body.jobId }, data: { publishedAt: null } });
      const blockedEvent = event('MANUAL_REPORT');
      const blocked = await call('/telemetry', crewToken, blockedEvent);
      await prisma.user.update({ where: { id: users.crew.id }, data: { disabled: true } });
      const simulation = { scenarioType: 'BASELINE_PROJECTION', crewMemberId: crewId, projection: measurement };
      const simKey = randomUUID();
      const simulated = await call('/simulator/run', operator, simulation, 'POST', { 'Idempotency-Key': simKey });
      assert.equal(simulated.status, 202);
      // Change the live reference after acceptance; simulation must use its captured version.
      await prisma.individualBaseline.create({ data: { crewMemberId: crewId, zone: 'HEAD_EYES', baselineData: { schemaVersion: 1, rules: [{
        ...baseline.baselineData.rules[0], baseline: 112,
      }] } } });
      worker = await startWorker();
      await wait(lost.body.jobId);
      const denied = await wait(blocked.body.jobId, 'FAILED');
      assert.equal(denied.errorCode, 'ACCESS_REVOKED');
      assert.equal(await prisma.healthRecord.count({ where: { id: blocked.body.jobId } }), 0);
      const projected = await wait(simulated.body.jobId);
      assert.equal(projected.result.mode, 'SIMULATION'); assert.equal(projected.result.riskStatus, 'CRITICAL');
      assert.equal(projected.result.baselineId, baseline.id); assert.equal(projected.result.evidence[0].delta, 12);
      assert.equal(await prisma.healthRecord.count({ where: { id: simulated.body.jobId } }), 0);
      assert.equal((await call('/simulator/run', operator, simulation, 'POST', { 'Idempotency-Key': simKey })).body.jobId, simulated.body.jobId);
      await prisma.user.update({ where: { id: users.crew.id }, data: { disabled: false } });
      const manualRetry = await call(`/jobs/${blocked.body.jobId}/retry`, operator, {});
      assert.equal(manualRetry.status, 202); assert.equal(manualRetry.body.generation, 1);
      await wait(blocked.body.jobId);
      assert.equal(await prisma.healthRecord.count({ where: { id: blocked.body.jobId } }), 1);
      const originalReplay = await call('/telemetry', operator, original);
      assert.equal(originalReplay.body.jobId, firstId); assert.equal(originalReplay.body.state, 'COMPLETED');
      await prisma.user.update({ where: { id: users.operator.id }, data: { role: 'CREW_MEMBER', crewMemberId: crewId } });
      assert.equal((await call(`/jobs/${envTask.body.jobId}`, operator)).status, 404, 'Role downgrade must not expose previously submitted mission-wide job results');
    } finally {
      if (worker) await worker.close();
      if (queue?.queue) await queue.queue.obliterate({ force: true }); // Unique test-only Redis prefix.
      if (api) await api.close();
      await prisma.mission.deleteMany({ where: { id: { in: [missionId, foreignMission] } } });
      await prisma.$disconnect();
    }
  });
