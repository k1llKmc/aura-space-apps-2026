import { AlertSeverity, BodyZone, DataSourceType } from '@prisma/client';
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
export type DailyHealthCheckRequest = z.infer<typeof dailyHealthCheckSchema>;
export type RiskStatus = Exclude<AlertSeverity, 'OUTDATED'>;
export type DataState = 'CURRENT' | 'STALE' | 'MISSING';

export interface HealthZoneStatus {
  zone: BodyZone;
  status: AlertSeverity;
  riskStatus: RiskStatus | null;
  dataState: DataState;
  lastChecked: string | null;
  isOutdated: boolean;
  sourceType: DataSourceType | null;
  metrics: Record<string, unknown> | null;
  message: string;
}

export interface CrewHealthResponse {
  crewMemberId: string;
  name: string;
  role: string;
  evaluatedAt: string;
  overallStatus: AlertSeverity;
  hasOutdatedData: boolean;
  zones: HealthZoneStatus[];
}

export interface DailyHealthCheckResponse {
  success: true;
  checkId: string;
  recordedAt: string;
  /** UTC calendar date, YYYY-MM-DD. */
  checkDate: string;
  xpEarned: number;
  currentStreak: number;
  message: string;
}
