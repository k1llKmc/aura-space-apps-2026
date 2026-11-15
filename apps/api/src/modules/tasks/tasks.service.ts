import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { BackgroundTask, Prisma, TaskKind } from '@prisma/client';
import type { AuthUser } from '@aura/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { TaskQueue } from './task-queue.service';
import { canonical } from './task.schemas';

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService, private readonly queue: TaskQueue) {}
  async accept(actor: AuthUser, kind: TaskKind, dedupKey: string, payload: unknown, hashInput: unknown, crewMemberId: string | null) {
    const payloadHash = createHash('sha256').update(canonical(hashInput)).digest('hex');
    const task = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${dedupKey}))`;
      const existing = await tx.backgroundTask.findUnique({ where: { dedupKey } });
      if (existing) {
        if (existing.payloadHash !== payloadHash) throw new ConflictException('Event/idempotency key was already used with a different payload.');
        return existing;
      }
      const task = await tx.backgroundTask.create({ data: { missionId: actor.missionId, requesterId: actor.id, crewMemberId,
        kind, dedupKey, payloadHash, payload: payload as Prisma.InputJsonObject } });
      await tx.auditEvent.create({ data: { missionId: actor.missionId, crewMemberId, actorId: actor.id,
        action: `${kind}_ACCEPTED`, entityId: task.id, details: { kind } } });
      return task;
    });
    if (task.state === 'PENDING' || task.state === 'PROCESSING') await this.queue.tryPublish(task);
    return this.response(task);
  }
  async get(id: string, actor: AuthUser) {
    const task = await this.prisma.backgroundTask.findFirst({ where: { id, missionId: actor.missionId,
      ...(actor.role === 'CREW_MEMBER' ? { requesterId: actor.id, crewMemberId: actor.crewMemberId! } : {}) } });
    if (!task) throw new NotFoundException('Task not found in your accessible scope.');
    return task;
  }
  async retry(id: string, actor: AuthUser) {
    await this.get(id, actor);
    const task = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))`;
      const current = await tx.backgroundTask.findUniqueOrThrow({ where: { id } });
      if (current.state !== 'FAILED') throw new ConflictException('Only failed tasks can be retried.');
      const task = await tx.backgroundTask.update({ where: { id }, data: { state: 'PENDING', errorCode: null, generation: { increment: 1 }, publishedAt: null } });
      await tx.auditEvent.create({ data: { missionId: actor.missionId, crewMemberId: task.crewMemberId, actorId: actor.id,
        action: 'TASK_RETRIED', entityId: task.id, details: { generation: task.generation } } });
      return task;
    });
    await this.queue.tryPublish(task);
    return this.response(task);
  }
  response(task: BackgroundTask) {
    return { jobId: task.id, kind: task.kind, state: task.state, attempts: task.attempts, generation: task.generation,
      result: task.result, errorCode: task.errorCode, createdAt: task.createdAt.toISOString(), updatedAt: task.updatedAt.toISOString(), statusUrl: `/api/v1/jobs/${task.id}` };
  }
}
