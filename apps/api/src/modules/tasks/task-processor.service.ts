import { Injectable } from '@nestjs/common';
import { BackgroundTask, HealthRecord, Prisma } from '@prisma/client';
import { UnrecoverableError } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { HealthMonitor } from '../crew/health-monitor.service';
import { recordSchema, policySchema } from '../crew/health.schemas';
import { zoneHealth } from '../crew/crew.health';
import { telemetrySchema, simulationSchema } from './task.schemas';
import { z } from 'zod';

@Injectable()
export class TaskProcessor {
  constructor(private readonly prisma: PrismaService, private readonly monitor: HealthMonitor) {}
  async process(id: string, generation: number): Promise<unknown> {
    const task = await this.prisma.backgroundTask.findUnique({ where: { id } });
    if (!task || task.generation !== generation || task.state === 'FAILED') return null;
    if (task.state === 'COMPLETED') return task.result;
    await this.prisma.backgroundTask.updateMany({ where: { id, generation, state: { in: ['PENDING', 'PROCESSING'] } }, data: { state: 'PROCESSING', attempts: { increment: 1 }, errorCode: null } });
    let result: unknown;
    if (task.kind === 'HEALTH_RECHECK') {
      if (!task.crewMemberId) throw new UnrecoverableError('INVALID_TASK');
      await this.monitor.reconcileCrew(task.crewMemberId);
      result = { crewMemberId: task.crewMemberId, evaluated: true };
    } else if (task.kind === 'TELEMETRY') result = await this.telemetry(task);
    else result = await this.simulate(task);
    await this.prisma.$transaction(async (tx) => {
      const changed = await tx.backgroundTask.updateMany({ where: { id, generation, state: { notIn: ['COMPLETED', 'FAILED'] } },
        data: { state: 'COMPLETED', result: result as Prisma.InputJsonObject, errorCode: null } });
      if (changed.count && task.kind !== 'HEALTH_RECHECK') await tx.auditEvent.create({ data: { missionId: task.missionId,
        crewMemberId: task.crewMemberId, action: 'TASK_COMPLETED', entityId: id, details: { kind: task.kind, generation } } });
    });
    return result;
  }

  async fail(id: string, generation: number, error: unknown, final: boolean) {
    const allowed = ['ACCESS_REVOKED', 'INVALID_TASK', 'MISSING_BASELINE'];
    const errorCode = error instanceof UnrecoverableError && allowed.includes(error.message) ? error.message : 'PROCESSING_FAILED';
    await this.prisma.$transaction(async (tx) => {
      const task = await tx.backgroundTask.findUnique({ where: { id } });
      if (!task || task.generation !== generation || ['COMPLETED', 'FAILED'].includes(task.state)) return;
      const changed = await tx.backgroundTask.updateMany({ where: { id, generation, state: { notIn: ['COMPLETED', 'FAILED'] } },
        data: { state: final ? 'FAILED' : 'PENDING', errorCode } });
      if (changed.count) await tx.auditEvent.create({ data: { missionId: task.missionId, crewMemberId: task.crewMemberId,
        action: final ? 'TASK_FAILED' : 'TASK_RETRY_SCHEDULED', entityId: id, details: { errorCode, generation, attempts: task.attempts } } });
    });
  }

  private async authorize(tx: Prisma.TransactionClient, task: BackgroundTask, manual: boolean) {
    const user = task.requesterId ? await tx.user.findUnique({ where: { id: task.requesterId } }) : null;
    if (!user || user.disabled || user.missionId !== task.missionId) throw new UnrecoverableError('ACCESS_REVOKED');
    if (user.crewMemberId && !await tx.crewMember.findFirst({ where: { id: user.crewMemberId, missionId: user.missionId } })) throw new UnrecoverableError('ACCESS_REVOKED');
    if (task.crewMemberId) {
      const crew = await tx.crewMember.findFirst({ where: { id: task.crewMemberId, missionId: task.missionId } });
      if (!crew) throw new UnrecoverableError('ACCESS_REVOKED');
    }
    if (user.role === 'CREW_MEMBER' && (!manual || user.crewMemberId !== task.crewMemberId)) throw new UnrecoverableError('ACCESS_REVOKED');
  }

  private async telemetry(task: BackgroundTask) {
    const parsed = telemetrySchema.safeParse(task.payload);
    if (!parsed.success) throw new UnrecoverableError('INVALID_TASK');
    const event = parsed.data;
    const measurement = event.kind === 'HEALTH' ? recordSchema.parse(event.measurement) : null;
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${task.id}))`;
      await this.authorize(tx, task, event.kind === 'HEALTH' && measurement!.sourceType === 'MANUAL_REPORT');
      if (event.kind === 'HEALTH') {
        if (task.crewMemberId !== event.crewMemberId) throw new UnrecoverableError('INVALID_TASK');
        const existing = await tx.healthRecord.findUnique({ where: { id: task.id } });
        if (!existing) {
          await tx.healthRecord.create({ data: { id: task.id, crewMemberId: event.crewMemberId, ...measurement!, recordedAt: new Date(event.recordedAt),
            isOutdated: Date.now() - Date.parse(event.recordedAt) > 7 * 86400000 } });
          await this.recordAudit(tx, task, event.producerId, event.eventId, measurement!.sourceType);
        }
        return { recordId: task.id, crewMemberId: event.crewMemberId, sourceType: measurement!.sourceType, recordedAt: event.recordedAt };
      }
      const existing = await tx.environmentRecord.findUnique({ where: { id: task.id } });
      if (!existing) {
        await tx.environmentRecord.create({ data: { id: task.id, missionId: task.missionId, ...event.metrics, sourceType: event.sourceType, recordedAt: new Date(event.recordedAt) } });
        await this.recordAudit(tx, task, event.producerId, event.eventId, event.sourceType);
      }
      return { environmentRecordId: task.id, missionId: task.missionId, sourceType: event.sourceType, recordedAt: event.recordedAt };
    });
    if (event.kind === 'HEALTH') await this.afterTelemetry(task, event.crewMemberId);
    return result;
  }

  protected async afterTelemetry(_task: BackgroundTask, crewId: string) { await this.monitor.reconcileCrew(crewId); }

  private async recordAudit(tx: Prisma.TransactionClient, task: BackgroundTask, producerId: string, eventId: string, sourceType: string) {
    await tx.auditEvent.create({ data: { missionId: task.missionId, crewMemberId: task.crewMemberId, actorId: task.requesterId,
      action: 'TELEMETRY_RECORDED', entityId: task.id, details: { producerId, eventId, sourceType } } });
  }

  private async simulate(task: BackgroundTask) {
    const envelope = z.object({ request: simulationSchema, baselineId: z.string().uuid(), baselineData: policySchema }).safeParse(task.payload);
    if (!envelope.success) throw new UnrecoverableError('INVALID_TASK');
    const { request, baselineId, baselineData } = envelope.data;
    const projection = recordSchema.parse(request.projection);
    await this.prisma.$transaction((tx) => this.authorize(tx, task, false));
    if (task.crewMemberId !== request.crewMemberId) throw new UnrecoverableError('INVALID_TASK');
    const record = { id: task.id, crewMemberId: request.crewMemberId, ...projection, recordedAt: task.createdAt, isOutdated: false } as HealthRecord;
    const zone = zoneHealth(projection.zone, record, task.createdAt, { id: baselineId, crewMemberId: request.crewMemberId, zone: projection.zone, baselineData, createdAt: task.createdAt });
    return { mode: 'SIMULATION', scenarioType: 'BASELINE_PROJECTION', modelVersion: 'baseline-v1', crewMemberId: request.crewMemberId,
      zone: projection.zone, baselineId, riskStatus: zone.riskStatus, assessmentComplete: zone.assessmentComplete, evidence: zone.evidence,
      explanation: 'Synthetic comparison with the captured reference policy. No measurements, clinical alerts or crew status were changed.' };
  }
}
