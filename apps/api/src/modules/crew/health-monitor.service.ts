import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CrewService } from './crew.service';

@Injectable()
export class HealthMonitor implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private initial?: NodeJS.Timeout;
  private busy = false;
  private pending?: Promise<void>;
  private readonly logger = new Logger(HealthMonitor.name);
  constructor(private readonly prisma: PrismaService, private readonly crew: CrewService) {}
  onModuleInit() {
    if (process.env.HEALTH_SWEEP_ENABLED === 'false') return;
    const seconds = Number(process.env.HEALTH_SWEEP_INTERVAL_SECONDS || 60);
    if (!Number.isInteger(seconds) || seconds < 10 || seconds > 86400) throw new Error('HEALTH_SWEEP_INTERVAL_SECONDS must be 10–86400.');
    const run = () => {
      if (this.busy) return;
      this.pending = this.sweep().catch((error) => this.logger.error('Health sweep failed; it will retry on the next interval.', error instanceof Error ? error.stack : undefined));
    };
    this.initial = setTimeout(run, 1000); this.initial.unref();
    this.timer = setInterval(run, seconds * 1000); this.timer.unref();
  }
  async onModuleDestroy() { clearTimeout(this.initial); clearInterval(this.timer); await this.pending; }
  async refreshCrew(id: string) {
    try { await this.reconcileCrew(id); }
    catch (error) { this.logger.error('Measurement saved; evaluation will retry on the next sweep.', error instanceof Error ? error.stack : undefined); }
  }
  async sweep() {
    if (this.busy) return;
    this.busy = true;
    try {
      let cursor: string | undefined;
      while (true) {
        const batch = await this.prisma.crewMember.findMany({ orderBy: { id: 'asc' }, take: 50,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}), select: { id: true } });
        for (const member of batch) {
          try { await this.reconcileCrew(member.id); }
          catch (error) { this.logger.error(`Health check failed for crew ${member.id}; continuing with the next profile.`, error instanceof Error ? error.stack : undefined); }
        }
        if (batch.length < 50) break;
        cursor = batch[batch.length - 1].id;
      }
    } finally { this.busy = false; }
  }
  async reconcileCrew(id: string) {
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))`;
      const member = await tx.crewMember.findUnique({ where: { id } });
      if (!member) return;
      const profile = await this.crew.getHealth(id, tx);
      for (const zone of profile.zones) {
        const previous = await tx.zoneState.findUnique({ where: { crewMemberId_zone: { crewMemberId: id, zone: zone.zone } } });
        const result = zone as unknown as Prisma.InputJsonObject;
        // Compare JSON semantically: PostgreSQL JSONB does not preserve key order.
        const canonical = (value: unknown): string => {
          if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
          if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
          return JSON.stringify(value);
        };
        if (!previous || canonical(previous.result) !== canonical(result)) {
          await tx.auditEvent.create({ data: { missionId: member.missionId, crewMemberId: id, action: 'HEALTH_STATE_CHANGED',
            entityId: zone.recordId, details: { zone: zone.zone, previous: previous?.result ?? null, next: result } } });
        }
        await tx.zoneState.upsert({ where: { crewMemberId_zone: { crewMemberId: id, zone: zone.zone } },
          create: { crewMemberId: id, zone: zone.zone, result, evaluatedAt: new Date(profile.evaluatedAt) },
          update: { result, evaluatedAt: new Date(profile.evaluatedAt) } });
        const desired: { key: string; origin: string; severity: 'OUTDATED' | 'ATTENTION' | 'CRITICAL'; message: string }[] = [];
        if (zone.isOutdated) desired.push({ key: `${id}/${zone.zone}/freshness/${zone.recordId || 'missing'}`, origin: 'DATA_FRESHNESS', severity: 'OUTDATED', message: zone.dataState === 'MISSING' ? 'No zone-specific measurements are available.' : 'Measurements are older than seven days.' });
        if (zone.riskStatus === 'ATTENTION' || zone.riskStatus === 'CRITICAL') desired.push({ key: `${id}/${zone.zone}/risk/${zone.recordId}/${zone.baselineId}`, origin: 'HEALTH_RISK', severity: zone.riskStatus, message: `${zone.riskStatus}: configured baseline deviation exceeded. ${zone.evidence.map((item) => `${item.metric}: ${item.reason}`).join(' ')}` });
        const obsolete = await tx.alert.findMany({ where: { crewMemberId: id, zone: zone.zone, origin: { in: ['HEALTH_RISK', 'DATA_FRESHNESS'] },
          isResolved: false, ...(desired.length ? { dedupKey: { notIn: desired.map((item) => item.key) } } : {}) } });
        for (const alert of obsolete) {
          const changed = await tx.alert.updateMany({ where: { id: alert.id, isResolved: false }, data: { isResolved: true, resolvedAt: new Date(), resolutionNote: 'Condition superseded or cleared by health evaluation.' } });
          if (changed.count) await tx.auditEvent.create({ data: { missionId: member.missionId, crewMemberId: id, action: 'ALERT_AUTO_RESOLVED', entityId: alert.id, details: { zone: zone.zone, origin: alert.origin } } });
        }
        for (const item of desired) {
          const exists = await tx.alert.findUnique({ where: { dedupKey: item.key } });
          // Acknowledgement suppresses this episode, never the current measured risk.
          if (exists) continue;
          const alert = await tx.alert.create({ data: { missionId: member.missionId, crewMemberId: id, zone: zone.zone,
            origin: item.origin, dedupKey: item.key, hazardType: 'HOSTILE_ENVIRONMENT', severity: item.severity,
            title: `${zone.zone}: ${item.origin === 'HEALTH_RISK' ? 'baseline review required' : 'measurement update required'}`, message: item.message } });
          await tx.auditEvent.create({ data: { missionId: member.missionId, crewMemberId: id, action: 'ALERT_GENERATED', entityId: alert.id,
            details: { zone: zone.zone, origin: item.origin, severity: item.severity, recordId: zone.recordId, baselineId: zone.baselineId } } });
        }
      }
      await tx.healthRecord.updateMany({ where: { crewMemberId: id, recordedAt: { lt: new Date(Date.parse(profile.evaluatedAt) - 7 * 86400000) } }, data: { isOutdated: true } });
      await tx.healthRecord.updateMany({ where: { crewMemberId: id, recordedAt: { gte: new Date(Date.parse(profile.evaluatedAt) - 7 * 86400000), lte: new Date(profile.evaluatedAt) } }, data: { isOutdated: false } });
    }, { timeout: 20000 });
  }
}
