import { BadRequestException, Body, Controller, ForbiddenException, Get, Headers, HttpCode, NotFoundException, Param, Post, Req } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { parse, uuid } from '../../common/validation';
import { AuthService } from '../auth/auth.service';
import type { AuthRequest } from '../auth/auth.guard';
import { recordSchema, policySchema } from '../crew/health.schemas';
import { TasksService } from './tasks.service';
import { telemetrySchema, simulationSchema } from './task.schemas';

@Controller()
export class TasksController {
  constructor(private readonly tasks: TasksService, private readonly auth: AuthService, private readonly prisma: PrismaService) {}

  @Post('telemetry')
  @HttpCode(202)
  async telemetry(@Body() body: unknown, @Req() request: AuthRequest) {
    const input = parse(telemetrySchema, body);
    if (Date.parse(input.recordedAt) > Date.now()) throw new BadRequestException('Future telemetry timestamps are not accepted.');
    let crewId: string | null = null;
    let normalized: unknown = input;
    if (input.kind === 'HEALTH') {
      const measurement = parse(recordSchema, input.measurement);
      crewId = input.crewMemberId;
      await this.auth.requireCrew(crewId, request.user);
      if (request.user.role === 'CREW_MEMBER' && measurement.sourceType !== 'MANUAL_REPORT') throw new ForbiddenException('Crew Members may submit only their own manual reports.');
      normalized = { ...input, measurement };
    } else if (request.user.role === 'CREW_MEMBER') throw new ForbiddenException('Operator role is required for environment telemetry.');
    return this.tasks.accept(request.user, 'TELEMETRY', `${request.user.missionId}/telemetry/${input.producerId}/${input.eventId}`, normalized, normalized, crewId);
  }

  @Post('simulator/run')
  @HttpCode(202)
  async simulate(@Body() body: unknown, @Headers('idempotency-key') rawKey: unknown, @Req() request: AuthRequest) {
    const key = parse(uuid, rawKey), input = parse(simulationSchema, body);
    if (request.user.role === 'CREW_MEMBER') throw new ForbiddenException('Operator role is required for simulations.');
    await this.auth.requireCrew(input.crewMemberId, request.user);
    const projection = parse(recordSchema, input.projection);
    const baseline = await this.prisma.individualBaseline.findFirst({ where: { crewMemberId: input.crewMemberId, zone: projection.zone, createdAt: { lte: new Date() } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
    if (!baseline) throw new NotFoundException('No baseline exists for this zone.');
    if (!policySchema.safeParse(baseline.baselineData).success) throw new BadRequestException('Configure a versioned baseline policy before simulation.');
    const normalized = { ...input, projection };
    return this.tasks.accept(request.user, 'SIMULATION', `${request.user.missionId}/simulation/${request.user.id}/${key}`,
      { request: normalized, baselineId: baseline.id, baselineData: baseline.baselineData }, normalized, input.crewMemberId);
  }

  @Get('jobs/:id')
  async job(@Param('id') id: string, @Req() request: AuthRequest) { return this.tasks.response(await this.tasks.get(parse(uuid, id), request.user)); }
  @Post('jobs/:id/retry')
  @HttpCode(202)
  retry(@Param('id') id: string, @Req() request: AuthRequest) { return this.tasks.retry(parse(uuid, id), request.user); }
}
