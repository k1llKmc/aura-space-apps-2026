import { AlertSeverity, BodyZone, HealthRecord } from '@prisma/client';
import type { HealthZoneStatus } from './crew.contracts';

export const bodyZones = [BodyZone.HEAD_EYES, BodyZone.CHEST_CARDIO,
  BodyZone.ABDOMEN_METABOLISM, BodyZone.WHOLE_BODY_IMMUNE, BodyZone.SKELETON_MUSCLES];

export function zoneHealth(zone: BodyZone, record: HealthRecord | undefined, now: Date): HealthZoneStatus {
  const dataState = !record ? 'MISSING'
    : now.getTime() - record.recordedAt.getTime() > 7 * 86400000 ? 'STALE' : 'CURRENT';
  // There is no persisted, approved zone assessment yet. Do not infer a diagnosis.
  return {
    zone, status: AlertSeverity.OUTDATED, riskStatus: null, dataState,
    lastChecked: record?.recordedAt.toISOString() ?? null,
    isOutdated: dataState !== 'CURRENT', sourceType: record?.sourceType ?? null,
    metrics: record?.metrics && typeof record.metrics === 'object' && !Array.isArray(record.metrics)
      ? record.metrics as Record<string, unknown> : null,
    message: dataState === 'MISSING' ? 'No zone-specific measurements are available.'
      : dataState === 'STALE' ? 'Measurements are older than seven days. A new examination is required.'
      : 'Measurements are current; a risk assessment is not yet available.',
  };
}

export function overallStatus(statuses: AlertSeverity[]): AlertSeverity {
  for (const severity of [AlertSeverity.CRITICAL, AlertSeverity.ATTENTION, AlertSeverity.OUTDATED]) {
    if (statuses.includes(severity)) return severity;
  }
  return AlertSeverity.NOMINAL;
}

export function streakForDate(checkDate: string, previousDates: string[]): number {
  const dates = new Set(previousDates);
  let streak = 1;
  const cursor = new Date(`${checkDate}T00:00:00.000Z`);
  cursor.setUTCDate(cursor.getUTCDate() - 1);
  while (dates.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}
