import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import type { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { queueName, queuePrefix, redisOptions } from './redis.config';
import { canonical } from './task.schemas';

@Injectable()
export class TaskQueue implements OnModuleInit, OnModuleDestroy {
  queue?: Queue;
  private available = false;
  private readonly logger = new Logger(TaskQueue.name);
  constructor(private readonly prisma: PrismaService) {}
  onModuleInit() {
    if (process.env.TASK_QUEUE_ENABLED === 'false') return;
    this.queue = new Queue(queueName, { connection: redisOptions(), prefix: queuePrefix(),
      defaultJobOptions: { attempts: 5, backoff: { type: 'exponential', delay: 1000 }, removeOnComplete: { age: 86400, count: 10000 }, removeOnFail: { age: 604800, count: 10000 } } });
    this.queue.on('error', () => this.logger.warn('Redis queue unavailable; durable pending tasks remain in PostgreSQL.'));
    void this.queue.client.then((client) => {
      this.available = client.status === 'ready';
      client.on('ready', () => { this.available = true; }); client.on('close', () => { this.available = false; });
    }).catch(() => {});
  }
  async onModuleDestroy() { await this.queue?.close(); }
  async ping() {
    if (!this.queue) return 'disabled';
    if (!this.available) throw new Error('Redis unavailable');
    await Promise.race([this.queue.client.then((client) => client.get(`${queuePrefix()}:health-probe`)), new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error('Redis timeout')), 2000); timer.unref(); })]);
    return 'ready';
  }
  async publish(task: { id: string; generation: number; kind?: string }) {
    if (!this.queue) return;
    if (!this.available) throw new Error('Redis unavailable');
    const jobId = `${task.id}-g${task.generation}`;
    const existing = await this.queue.getJob(jobId);
    if (existing && await existing.getState() === 'failed') {
      await this.prisma.$transaction(async (tx) => {
        const row = await tx.backgroundTask.findUnique({ where: { id: task.id } });
        const changed = await tx.backgroundTask.updateMany({ where: { id: task.id, generation: task.generation, state: { in: ['PENDING', 'PROCESSING'] } }, data: { state: 'FAILED', errorCode: 'PROCESSING_FAILED' } });
        if (changed.count && row) await tx.auditEvent.create({ data: { missionId: row.missionId, crewMemberId: row.crewMemberId,
          action: 'TASK_FAILED', entityId: row.id, details: { errorCode: 'PROCESSING_FAILED', generation: task.generation } } });
      });
      return;
    }
    await this.queue.add('task', { taskId: task.id, generation: task.generation }, { jobId, priority: task.kind === 'SIMULATION' ? 10 : task.kind === 'HEALTH_RECHECK' ? 3 : 1 });
    await this.prisma.backgroundTask.updateMany({ where: { id: task.id, generation: task.generation, state: { in: ['PENDING', 'PROCESSING'] } }, data: { publishedAt: new Date() } });
  }
  async tryPublish(task: { id: string; generation: number }) {
    try { await this.publish(task); }
    catch { this.logger.warn(`Task ${task.id} saved; the dispatcher will retry publishing.`); }
  }
  async dispatchPending() {
    const tasks = await this.prisma.backgroundTask.findMany({ where: { state: { in: ['PENDING', 'PROCESSING'] },
      OR: [{ publishedAt: null }, { publishedAt: { lt: new Date(Date.now() - 30000) } }] }, orderBy: [{ publishedAt: { sort: 'asc', nulls: 'first' } }, { createdAt: 'asc' }], take: 100 });
    for (const task of tasks) await this.publish(task);
  }
  async createHealthTask(tx: Prisma.TransactionClient, missionId: string, crewMemberId: string, trigger: string) {
    const dedupKey = `health/${crewMemberId}/${trigger}`;
    return tx.backgroundTask.upsert({ where: { dedupKey }, update: {}, create: { missionId, crewMemberId,
      kind: 'HEALTH_RECHECK', dedupKey, payloadHash: createHash('sha256').update(canonical({ crewMemberId })).digest('hex'), payload: { crewMemberId } } });
  }
}
