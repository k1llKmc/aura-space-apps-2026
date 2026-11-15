import { Controller, Get, Query, Req } from '@nestjs/common';
import { z } from 'zod';
import type { AuditEventResponse, ListResponse } from '@aura/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { pagination, parse } from './validation';
import type { AuthRequest } from '../modules/auth/auth.guard';
import { AuthService } from '../modules/auth/auth.service';
@Controller('audit')
export class AuditController {
  constructor(private readonly prisma: PrismaService, private readonly auth: AuthService) {}
  @Get()
  async list(@Query() query: unknown, @Req() request: AuthRequest): Promise<ListResponse<AuditEventResponse>> {
    const { offset, limit, crewMemberId } = parse(pagination.extend({ crewMemberId: z.string().uuid().optional() }).strict(), query);
    if (crewMemberId) await this.auth.requireCrew(crewMemberId, request.user);
    const where = { missionId: request.user.missionId,
      ...(request.user.role === 'CREW_MEMBER' ? { crewMemberId: request.user.crewMemberId! } : crewMemberId ? { crewMemberId } : {}) };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditEvent.findMany({ where, include: { actor: { select: { username: true } } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: offset, take: limit }),
      this.prisma.auditEvent.count({ where }),
    ]);
    return { items: items.map(({ actor, ...item }) => ({ ...item, actorUsername: actor?.username ?? null, createdAt: item.createdAt.toISOString() })), total, offset, limit };
  }
}
