import { z } from 'zod';
import { DataSourceType } from '@prisma/client';
import { recordSchema } from '../crew/health.schemas';
const envelope = {
  eventId: z.string().uuid(), producerId: z.string().regex(/^[a-zA-Z0-9_.-]{3,64}$/),
  recordedAt: z.string().datetime({ offset: true }).transform((value) => new Date(value).toISOString()),
};
const environmentMetrics = z.object({ radiationCans: z.number().finite().nonnegative(), totalRadiation: z.number().finite().nonnegative(),
  pO2: z.number().finite().nonnegative(), co2Ppm: z.number().finite().min(0).max(1000000),
  cabinPressure: z.number().finite().positive(), temperature: z.number().finite(), humidity: z.number().finite().min(0).max(100) }).strict();
export const telemetrySchema = z.discriminatedUnion('kind', [
  z.object({ ...envelope, kind: z.literal('HEALTH'), crewMemberId: z.string().uuid(), measurement: z.unknown() }).strict(),
  z.object({ ...envelope, kind: z.literal('ENVIRONMENT'), sourceType: z.nativeEnum(DataSourceType), metrics: environmentMetrics }).strict(),
]).superRefine((value, context) => {
  if (value.kind === 'HEALTH') {
    const result = recordSchema.safeParse(value.measurement);
    if (!result.success) for (const issue of result.error.issues) context.addIssue({ ...issue, path: ['measurement', ...issue.path] });
    else if (result.data.recordedAt) context.addIssue({ code: 'custom', message: 'Use envelope recordedAt, not measurement.recordedAt.' });
  }
});
export const simulationSchema = z.object({ scenarioType: z.literal('BASELINE_PROJECTION'), crewMemberId: z.string().uuid(),
  projection: z.unknown() }).strict().superRefine((value, context) => {
    const result = recordSchema.safeParse(value.projection);
    if (!result.success) for (const issue of result.error.issues) context.addIssue({ ...issue, path: ['projection', ...issue.path] });
    else if (result.data.recordedAt || result.data.symptoms.length) context.addIssue({ code: 'custom', message: 'Projection has no observation timestamp or symptoms.' });
  });
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
  return JSON.stringify(value);
}
