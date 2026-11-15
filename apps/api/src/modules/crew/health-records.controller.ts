import { BadRequestException, Body, Controller, ForbiddenException, Get, Param, Post, Query, Req } from '@nestjs/common';
import { BodyZone, DataSourceType, Prisma } from '@prisma/client';
import { z } from 'zod';
import { zoneMetricCatalog, type BaselineResponse, type HealthRecordResponse, type ListResponse } from '@aura/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { pagination, parse, uuid } from '../../common/validation';
import { AuthService } from '../auth/auth.service';
import type { AuthRequest } from '../auth/auth.guard';
import { baselineSchema, recordSchema } from './health.schemas';
import { TaskQueue } from '../tasks/task-queue.service';
const historyQuery = pagination.extend({ zone: z.nativeEnum(BodyZone).optional(), sourceType: z.nativeEnum(DataSourceType).optional(),
  from: z.string().datetime({ offset: true }).optional(), to: z.string().datetime({ offset: true }).optional() }).strict()
  .refine((value) => !value.from || !value.to || Date.parse(value.from) <= Date.parse(value.to), 'from must precede to.');
@Controller('crew')
export class HealthRecordsController {
  constructor(private readonly prisma: PrismaService, private readonly auth: AuthService, private readonly queue: TaskQueue) {}

  @Get('health/rules-catalog')
  catalogue() { return { rulesVersion: 'baseline-v1', metrics: zoneMetricCatalog }; }

  @Get(':id/records')
  async history(@Param('id') raw: string, @Query() query: unknown, @Req() request: AuthRequest): Promise<ListResponse<HealthRecordResponse>> {
    const id = parse(uuid, raw); await this.auth.requireCrew(id, request.user);
    const { offset, limit, zone, sourceType, from, to } = parse(historyQuery, query);
    const now = new Date();
    const where = { crewMemberId: id, ...(zone ? { zone } : {}), ...(sourceType ? { sourceType } : {}),
      recordedAt: { ...(from ? { gte: new Date(from) } : {}), lte: new Date(Math.min(to ? Date.parse(to) : now.getTime(), now.getTime())) } };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.healthRecord.findMany({ where, orderBy: [{ recordedAt: 'desc' }, { id: 'desc' }], skip: offset, take: limit }),
      this.prisma.healthRecord.count({ where }),
    ]);
    return { items: items.map((record) => ({ ...record, recordedAt: record.recordedAt.toISOString(), isOutdated: now.getTime() - record.recordedAt.getTime() > 7 * 86400000 })), total, offset, limit };
  }

  @Post(':id/records')
  async record(@Param('id') raw: string, @Body() body: unknown, @Req() request: AuthRequest): Promise<HealthRecordResponse> {
    this.requireOperator(request);
    const id = parse(uuid, raw); await this.auth.requireCrew(id, request.user);
    const input = parse(recordSchema, body);
    const now = new Date(), recordedAt = input.recordedAt ? new Date(input.recordedAt) : now;
    if (recordedAt > now) throw new BadRequestException('Future-dated measurements are not accepted.');
    const { record, task } = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))`;
      const record = await tx.healthRecord.create({ data: { crewMemberId: id, ...input, recordedAt,
        isOutdated: now.getTime() - recordedAt.getTime() > 7 * 86400000 } });
      await tx.auditEvent.create({ data: { missionId: request.user.missionId, crewMemberId: id, actorId: request.user.id,
        action: 'HEALTH_RECORD_CREATED', entityId: record.id, details: { zone: record.zone, sourceType: record.sourceType, recordedAt: recordedAt.toISOString(), metrics: input.metrics, units: input.units } } });
      const task = await this.queue.createHealthTask(tx, request.user.missionId, id, record.id);
      return { record, task };
    });
    await this.queue.tryPublish(task);
    return { ...record, recordedAt: record.recordedAt.toISOString(), assessmentJobId: task.id };
  }

  @Get(':id/baselines')
  async baselines(@Param('id') raw: string, @Query() query: unknown, @Req() request: AuthRequest): Promise<ListResponse<BaselineResponse>> {
    const id = parse(uuid, raw); await this.auth.requireCrew(id, request.user);
    const { offset, limit, zone } = parse(pagination.extend({ zone: z.nativeEnum(BodyZone).optional() }).strict(), query);
    const where = { crewMemberId: id, ...(zone ? { zone } : {}) };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.individualBaseline.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: offset, take: limit }),
      this.prisma.individualBaseline.count({ where }),
    ]);
    return { items: items.map((item) => ({ id: item.id, zone: item.zone, baselineData: item.baselineData, createdAt: item.createdAt.toISOString() })), total, offset, limit };
  }

  @Post(':id/baselines')
  async baseline(@Param('id') raw: string, @Body() body: unknown, @Req() request: AuthRequest): Promise<BaselineResponse> {
    this.requireOperator(request);
    const id = parse(uuid, raw); await this.auth.requireCrew(id, request.user);
    const input = parse(baselineSchema, body);
    const { baseline, task } = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))`;
      const baselineData = { schemaVersion: 1, rules: input.rules } as unknown as Prisma.InputJsonObject;
      const baseline = await tx.individualBaseline.create({ data: { crewMemberId: id, zone: input.zone, baselineData } });
      await tx.auditEvent.create({ data: { missionId: request.user.missionId, crewMemberId: id, actorId: request.user.id,
        action: 'BASELINE_SET', entityId: baseline.id, details: { zone: input.zone, reason: input.reason, baselineData } } });
      const task = await this.queue.createHealthTask(tx, request.user.missionId, id, baseline.id);
      return { baseline, task };
    });
    await this.queue.tryPublish(task);
    return { id: baseline.id, zone: baseline.zone, baselineData: baseline.baselineData, createdAt: baseline.createdAt.toISOString(), assessmentJobId: task.id };
  }
  private requireOperator(request: AuthRequest) {
    if (request.user.role === 'CREW_MEMBER') throw new ForbiddenException('Commander or Medical Officer role is required.');
  }
}
