import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { hostname } from 'node:os';
import { Worker, UnrecoverableError } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { TaskQueue } from './task-queue.service';
import { TaskProcessor } from './task-processor.service';
import { queueName, queuePrefix, redisOptions } from './redis.config';

@Injectable()
export class BackgroundWorker implements OnModuleInit, OnModuleDestroy {
  private worker?: Worker;
  private dispatcher?: NodeJS.Timeout;
  private heartbeat?: NodeJS.Timeout;
  private dispatching = false;
  private closing = false;
  private readonly logger = new Logger(BackgroundWorker.name);
  constructor(private readonly queue: TaskQueue, private readonly processor: TaskProcessor, private readonly prisma: PrismaService) {}
  async onModuleInit() {
    if (!this.queue.queue) throw new Error('Worker requires TASK_QUEUE_ENABLED=true.');
    const concurrency = Number(process.env.WORKER_CONCURRENCY || 4);
    if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 32) throw new Error('WORKER_CONCURRENCY must be 1–32.');
    this.worker = new Worker(queueName, async (job) => {
      if (job.name === 'health-scan') {
        try { await this.scheduleHealth(job.id!); return null; }
        catch { throw new Error('HEALTH_SCAN_FAILED'); }
      }
      const { taskId, generation } = job.data;
      if (typeof taskId !== 'string' || !Number.isInteger(generation)) throw new UnrecoverableError('INVALID_TASK');
      try { await this.processor.process(taskId, generation); return { taskId }; }
      catch (error) {
        const final = error instanceof UnrecoverableError || job.attemptsMade + 1 >= (job.opts.attempts || 1);
        try { await this.processor.fail(taskId, generation, error, final); }
        catch { this.logger.warn(`Failure status for task ${taskId} will be recovered by the dispatcher.`); }
        this.logger.warn(`Task ${taskId} attempt failed; ${final ? 'manual retry is available' : 'automatic retry scheduled'}.`);
        // BullMQ persists errors/return values in Redis: never put medical payloads there.
        if (error instanceof UnrecoverableError) throw new UnrecoverableError('TASK_UNRECOVERABLE');
        throw new Error('PROCESSING_FAILED');
      }
    }, { connection: redisOptions(true), prefix: queuePrefix(), concurrency, maxStalledCount: 2 });
    this.worker.on('error', () => this.logger.warn('Worker connection failed; waiting for Redis recovery.'));
    this.worker.on('failed', (job, error) => {
      if (!job || job.name !== 'task') return;
      void job.getState().then((state) => state === 'failed' ? this.processor.fail(job.data.taskId, job.data.generation, error, true) : undefined)
        .catch(() => this.logger.warn('Failure status persistence will be recovered from the durable task.'));
    });
    await this.worker.waitUntilReady();
    const seconds = Number(process.env.HEALTH_SWEEP_INTERVAL_SECONDS || 60);
    if (!Number.isInteger(seconds) || seconds < 10 || seconds > 86400) throw new Error('HEALTH_SWEEP_INTERVAL_SECONDS must be 10–86400.');
    if (process.env.HEALTH_SWEEP_ENABLED !== 'false') {
      await this.queue.queue.upsertJobScheduler('health-scan', { every: seconds * 1000 }, { name: 'health-scan', data: {}, opts: { attempts: 5, backoff: { type: 'exponential', delay: 1000 }, removeOnComplete: { count: 100 }, removeOnFail: { count: 100 } } });
    } else await this.queue.queue.removeJobScheduler('health-scan');
    const dispatch = () => {
      if (this.dispatching || this.closing) return;
      this.dispatching = true;
      void this.queue.dispatchPending().catch(() => this.logger.warn('Dispatcher unavailable; pending tasks will be retried.')).finally(() => { this.dispatching = false; });
    };
    this.dispatcher = setInterval(dispatch, 2000); this.dispatcher.unref(); dispatch();
    const beat = () => { void this.writeHeartbeat().catch(() => {}); };
    this.heartbeat = setInterval(beat, 3000); this.heartbeat.unref(); await this.writeHeartbeat();
  }
  private async writeHeartbeat() {
    if (!this.closing && this.worker?.isRunning()) await (await this.queue.queue!.client).set(`${queuePrefix()}:worker:${hostname()}`, Date.now().toString(), { PX: 15000 });
  }
  private async scheduleHealth(trigger: string) {
    let cursor: string | undefined;
    while (true) {
      const batch = await this.prisma.crewMember.findMany({ orderBy: { id: 'asc' }, take: 50,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}), select: { id: true, missionId: true } });
      for (const crew of batch) await this.queue.createHealthTask(this.prisma, crew.missionId, crew.id, `scheduled-${trigger}`);
      if (batch.length < 50) break;
      cursor = batch[batch.length - 1].id;
    }
    await this.prisma.backgroundTask.deleteMany({ where: { kind: 'HEALTH_RECHECK', state: 'COMPLETED', createdAt: { lt: new Date(Date.now() - 7 * 86400000) } } });
  }
  async onModuleDestroy() {
    this.closing = true; clearInterval(this.dispatcher); clearInterval(this.heartbeat);
    await this.worker?.close();
  }
}
