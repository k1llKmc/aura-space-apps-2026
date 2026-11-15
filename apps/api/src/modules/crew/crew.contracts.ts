import { DataSourceType } from '@prisma/client';
import { z } from 'zod';

/** Contract revision: .ai_context/backend_contracts.md. No clinical thresholds. */
export const dailyHealthCheckSchema = z.object({
  crewMemberId: z.string().uuid(),
  sourceType: z.literal(DataSourceType.MANUAL_REPORT),
  moodScore: z.number().int().min(1).max(10),
  stressScore: z.number().int().min(1).max(10),
  fatigueScore: z.number().int().min(1).max(10),
  sleepHours: z.number().finite().min(0).max(24),
  symptoms: z.array(z.string().trim().min(1).max(100)).max(20)
    .refine((items) => new Set(items).size === items.length, 'Symptoms must be unique.'),
  notes: z.string().trim().max(2000),
}).strict();

export const idempotencyKeySchema = z.string().uuid();
export type { DailyHealthCheckRequest, DailyHealthCheckResponse, RiskStatus, DataState, HealthZoneStatus, CrewHealthResponse } from '@aura/shared-types';
