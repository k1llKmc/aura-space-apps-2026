import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
export function parse<S extends z.ZodTypeAny>(schema: S, value: unknown): z.output<S> {
  const result = schema.safeParse(value);
  if (!result.success) throw new BadRequestException(result.error.issues.map((issue) => `${issue.path.join('.') || 'request'}: ${issue.message}`));
  return result.data;
}
export const uuid = z.string().uuid();
export const pagination = z.object({
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
