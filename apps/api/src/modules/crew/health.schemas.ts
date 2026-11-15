import { z } from 'zod';
import { BodyZone, DataSourceType } from '@prisma/client';
import { zoneMetricCatalog } from '@aura/shared-types';
const rule = z.object({ metric: z.string(), unit: z.string(), baseline: z.number().finite(),
  comparison: z.enum(['ABSOLUTE', 'PERCENT']), direction: z.enum(['INCREASE', 'DECREASE', 'BOTH']),
  attentionDelta: z.number().finite().positive(), criticalDelta: z.number().finite().positive(),
  allowedSources: z.array(z.nativeEnum(DataSourceType)).min(1).max(3),
}).strict().refine((value) => value.criticalDelta > value.attentionDelta, 'Critical deviation must exceed attention deviation.')
  .refine((value) => value.comparison !== 'PERCENT' || value.baseline !== 0, 'Percentage comparison requires a nonzero baseline.');
export const policySchema = z.object({ schemaVersion: z.literal(1), rules: z.array(rule).min(1).max(10) }).strict();
export const baselineSchema = z.object({ zone: z.nativeEnum(BodyZone), rules: z.array(rule).min(1).max(10), reason: z.string().trim().min(1).max(2000) }).strict()
  .refine(({ zone, rules }) => rules.every((item) => Object.hasOwn(zoneMetricCatalog[zone], item.metric) && zoneMetricCatalog[zone][item.metric] === item.unit), 'Metrics/units must match the zone catalogue.')
  .refine(({ rules }) => new Set(rules.map((item) => item.metric)).size === rules.length, 'Each metric may have only one rule.');
export const recordSchema = z.object({ zone: z.nativeEnum(BodyZone), sourceType: z.nativeEnum(DataSourceType),
  metrics: z.record(z.number().finite()), units: z.record(z.string()), symptoms: z.array(z.string().trim().min(1).max(100)).max(20),
  recordedAt: z.string().datetime({ offset: true }).optional(),
}).strict().refine(({ zone, metrics, units }) => Object.keys(metrics).length > 0 && Object.keys(metrics).length <= 10 &&
  Object.keys(metrics).every((key) => Object.hasOwn(zoneMetricCatalog[zone], key) && units[key] === zoneMetricCatalog[zone][key]) &&
  Object.keys(units).length === Object.keys(metrics).length, 'Every metric requires its canonical zone and unit.');
