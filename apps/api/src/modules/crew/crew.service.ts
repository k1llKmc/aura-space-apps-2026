import { randomUUID } from 'node:crypto';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { CrewHealthResponse, DailyHealthCheckRequest, DailyHealthCheckResponse } from './crew.contracts';
import { bodyZones, overallStatus, streakForDate, zoneHealth } from './crew.health';

@Injectable()
export class CrewService {
  constructor(private readonly prisma: PrismaService) {}

  async getHealth(id: string): Promise<CrewHealthResponse> {
    const now = new Date();
    const crew = await this.prisma.crewMember.findUnique({ where: { id }, include: {
      healthRecords: { where: { zone: { not: null }, recordedAt: { lte: now } },
        orderBy: [{ recordedAt: 'desc' }, { id: 'desc' }], distinct: ['zone'] },
      alerts: { where: { isResolved: false } },
    } });
    if (!crew) throw new NotFoundException('Crew member not found.');
    const zones = bodyZones.map((zone) => zoneHealth(zone, crew.healthRecords.find((item) => item.zone === zone), now));
    return { crewMemberId: crew.id, name: crew.name, role: crew.role,
      evaluatedAt: now.toISOString(), zones,
      hasOutdatedData: zones.some((zone) => zone.isOutdated),
      overallStatus: overallStatus([...zones.map((zone) => zone.status),
        ...crew.alerts.filter((alert) => alert.severity !== 'OUTDATED').map((alert) => alert.severity)]),
    };
  }

  async submitCheck(payload: DailyHealthCheckRequest, key: string): Promise<{ replay: boolean; body: DailyHealthCheckResponse }> {
    // Serializable retries resolve races through the same replay/date checks.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const crew = await tx.crewMember.findUnique({ where: { id: payload.crewMemberId } });
          if (!crew) throw new NotFoundException('Crew member not found.');
          const existing = await tx.dailyHealthCheck.findUnique({ where: {
            crewMemberId_idempotencyKey: { crewMemberId: crew.id, idempotencyKey: key },
          } });
          if (existing) {
            // Schema parsing gives properties a stable order; JSONB does not.
            const original = existing.payload as Record<string, unknown>;
            if (Object.entries(payload).some(([field, value]) => JSON.stringify(original[field]) !== JSON.stringify(value))) {
              throw new ConflictException('Idempotency key was already used with a different payload.');
            }
            return { replay: true, body: existing.response as unknown as DailyHealthCheckResponse };
          }
          const now = new Date();
          const checkDate = now.toISOString().slice(0, 10);
          const previous = await tx.dailyHealthCheck.findMany({ where: { crewMemberId: crew.id, checkDate: { lte: checkDate } }, select: { checkDate: true } });
          if (previous.some((item) => item.checkDate === checkDate)) throw new ConflictException('A daily check already exists for this UTC date.');
          const body: DailyHealthCheckResponse = { success: true, checkId: randomUUID(), recordedAt: now.toISOString(), checkDate,
            xpEarned: 50, currentStreak: streakForDate(checkDate, previous.map((item) => item.checkDate)),
            message: 'Daily check successfully logged. Awarded 50 XP for consistency.' };
          await tx.dailyHealthCheck.create({ data: { id: body.checkId, crewMemberId: crew.id, checkDate, idempotencyKey: key,
            payload: payload as unknown as Prisma.InputJsonObject, response: body as unknown as Prisma.InputJsonObject,
            xpEarned: body.xpEarned, currentStreak: body.currentStreak, recordedAt: now } });
          await tx.healthRecord.create({ data: { id: body.checkId, crewMemberId: crew.id, sourceType: payload.sourceType,
            zone: null, metrics: { moodScore: payload.moodScore, stressScore: payload.stressScore,
              fatigueScore: payload.fatigueScore, sleepHours: payload.sleepHours, notes: payload.notes },
            symptoms: payload.symptoms, recordedAt: now } });
          return { replay: false, body };
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2034'].includes(error.code)) {
          if (attempt < 4) continue;
          throw new ConflictException('Concurrent daily check submission. Retry with the same idempotency key.');
        }
        throw error;
      }
    }
    throw new ConflictException('Daily check could not be saved.');
  }
}
