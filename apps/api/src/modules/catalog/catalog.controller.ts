import { Body, Controller, ForbiddenException, Get, NotFoundException, Param, Patch, Query, Req } from '@nestjs/common';
import { z } from 'zod';
import { HazardType } from '@prisma/client';
import type { AlertResponse, ListResponse, ProtocolResponse } from '@aura/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { pagination, parse, uuid } from '../../common/validation';
import type { AuthRequest } from '../auth/auth.guard';
const alertsQuery = pagination.extend({ isResolved: z.enum(['true', 'false']).optional(), severity: z.enum(['NOMINAL', 'OUTDATED', 'ATTENTION', 'CRITICAL']).optional() }).strict();
const protocolsQuery = pagination.extend({ hazard: z.nativeEnum(HazardType).optional() }).strict();
@Controller()
export class CatalogController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('alerts')
  async alerts(@Query() query: unknown, @Req() request: AuthRequest): Promise<ListResponse<AlertResponse>> {
    const { offset, limit, isResolved, severity } = parse(alertsQuery, query);
    const actor = request.user;
    const where = { missionId: actor.missionId,
      ...(actor.role === 'CREW_MEMBER' ? { OR: [{ crewMemberId: null }, { crewMemberId: actor.crewMemberId }] } : {}),
      ...(isResolved === undefined ? {} : { isResolved: isResolved === 'true' }), ...(severity ? { severity } : {}) };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.alert.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip: offset, take: limit }),
      this.prisma.alert.count({ where }),
    ]);
    return { items: items.map((item) => ({ ...item, createdAt: item.createdAt.toISOString(), resolvedAt: item.resolvedAt?.toISOString() ?? null })), total, offset, limit };
  }

  @Patch('alerts/:id/resolve')
  async resolve(@Param('id') rawId: string, @Body() body: unknown, @Req() request: AuthRequest): Promise<AlertResponse> {
    const actor = request.user;
    if (actor.role === 'CREW_MEMBER') throw new ForbiddenException('Commander or Medical Officer role is required.');
    const id = parse(uuid, rawId);
    const { note } = parse(z.object({ note: z.string().trim().min(1).max(2000) }).strict(), body);
    const where = { id, missionId: actor.missionId };
    // First resolver wins; repeats retain the original audit information.
    await this.prisma.alert.updateMany({ where: { ...where, isResolved: false },
      data: { isResolved: true, resolvedAt: new Date(), resolvedById: actor.id, resolutionNote: note } });
    const item = await this.prisma.alert.findFirst({ where });
    if (!item) throw new NotFoundException('Alert not found in your mission.');
    return { ...item, createdAt: item.createdAt.toISOString(), resolvedAt: item.resolvedAt?.toISOString() ?? null };
  }

  @Get('protocols')
  async protocols(@Query() query: unknown): Promise<ListResponse<ProtocolResponse>> {
    const { offset, limit, hazard } = parse(protocolsQuery, query);
    const where = hazard ? { hazard } : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.countermeasureProtocol.findMany({ where, orderBy: [{ title: 'asc' }, { id: 'asc' }], skip: offset, take: limit }),
      this.prisma.countermeasureProtocol.count({ where }),
    ]);
    return { items, total, offset, limit };
  }
  @Get('protocols/:id')
  async protocol(@Param('id') rawId: string): Promise<ProtocolResponse> {
    const item = await this.prisma.countermeasureProtocol.findUnique({ where: { id: parse(uuid, rawId) } });
    if (!item) throw new NotFoundException('Protocol not found.');
    return item;
  }
}
