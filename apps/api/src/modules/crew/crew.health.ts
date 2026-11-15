import { AlertSeverity, BodyZone, HealthRecord, IndividualBaseline } from '@prisma/client';
import type { HealthZoneStatus } from './crew.contracts';
import { aggregateStatus, type MetricEvidence, type RiskStatus } from '@aura/shared-types';
import { policySchema } from './health.schemas';

export const bodyZones = [BodyZone.HEAD_EYES, BodyZone.CHEST_CARDIO,
  BodyZone.ABDOMEN_METABOLISM, BodyZone.WHOLE_BODY_IMMUNE, BodyZone.SKELETON_MUSCLES];

export function zoneHealth(zone: BodyZone, record: HealthRecord | undefined, now: Date, baseline?: IndividualBaseline): HealthZoneStatus {
  const dataState = !record ? 'MISSING'
    : now.getTime() - record.recordedAt.getTime() > 7 * 86400000 ? 'STALE' : 'CURRENT';
  const policy = policySchema.safeParse(baseline?.baselineData);
  const metrics = record?.metrics && typeof record.metrics === 'object' && !Array.isArray(record.metrics)
    ? record.metrics as Record<string, unknown> : {};
  const units = record?.units && typeof record.units === 'object' && !Array.isArray(record.units)
    ? record.units as Record<string, unknown> : {};
  const evidence: MetricEvidence[] = policy.success ? policy.data.rules.map((rule) => {
    const value = metrics[rule.metric];
    const valid = !!record && rule.allowedSources.includes(record.sourceType) && units[rule.metric] === rule.unit && typeof value === 'number' && Number.isFinite(value);
    if (!valid) return { metric: rule.metric, unit: rule.unit, baseline: rule.baseline,
      current: typeof value === 'number' && Number.isFinite(value) ? value : null, delta: null,
      comparison: rule.comparison, riskStatus: null, reason: 'Metric is missing, has an incompatible unit, or comes from an unapproved source.' };
    const difference = (value as number) - rule.baseline;
    const directed = rule.direction === 'BOTH' ? Math.abs(difference) : Math.max(0, rule.direction === 'INCREASE' ? difference : -difference);
    const delta = rule.comparison === 'PERCENT' ? directed / Math.abs(rule.baseline) * 100 : directed;
    if (!Number.isFinite(delta)) return { metric: rule.metric, unit: rule.unit, baseline: rule.baseline, current: value as number,
      delta: null, comparison: rule.comparison, riskStatus: null, reason: 'Deviation exceeds supported numeric range.' };
    const riskStatus: RiskStatus = delta >= rule.criticalDelta ? 'CRITICAL' : delta >= rule.attentionDelta ? 'ATTENTION' : 'NOMINAL';
    return { metric: rule.metric, unit: rule.unit, baseline: rule.baseline, current: value as number, delta, comparison: rule.comparison, riskStatus,
      reason: `${rule.direction} deviation ${delta.toFixed(3)} ${rule.comparison === 'PERCENT' ? '%' : rule.unit}; attention >= ${rule.attentionDelta}, critical >= ${rule.criticalDelta}.` };
  }) : [];
  const assessmentComplete = evidence.length > 0 && evidence.every((item) => item.riskStatus !== null);
  const highest = aggregateStatus(evidence.flatMap((item) => item.riskStatus ? [item.riskStatus] : []));
  const riskStatus = highest === 'ATTENTION' || highest === 'CRITICAL' ? highest : assessmentComplete ? 'NOMINAL' : null;
  const status = riskStatus === 'ATTENTION' || riskStatus === 'CRITICAL' ? riskStatus
    : dataState !== 'CURRENT' || riskStatus === null ? 'OUTDATED' : 'NOMINAL';
  return {
    zone, status, riskStatus, dataState, recordId: record?.id ?? null, baselineId: baseline?.id ?? null,
    assessmentComplete, evidence, rulesVersion: 'baseline-v1',
    lastChecked: record?.recordedAt.toISOString() ?? null,
    isOutdated: dataState !== 'CURRENT', sourceType: record?.sourceType ?? null,
    metrics: record?.metrics && typeof record.metrics === 'object' && !Array.isArray(record.metrics)
      ? record.metrics as Record<string, unknown> : null,
    message: dataState === 'MISSING' ? 'No zone-specific measurements are available.'
      : dataState === 'STALE' ? 'Measurements are older than seven days. A new examination is required.'
      : riskStatus === null ? 'Measurements are current; approved rules or compatible measurements are missing.'
      : `${riskStatus}: compared with the configured reference. ${assessmentComplete ? 'All configured metrics assessed.' : 'Some configured metrics could not be assessed.'}`,
  };
}

export function overallStatus(statuses: AlertSeverity[]): AlertSeverity {
  return aggregateStatus(statuses);
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
