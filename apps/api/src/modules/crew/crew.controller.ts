import { BadRequestException, Body, Controller, Get, Headers, Param, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import { dailyHealthCheckSchema, idempotencyKeySchema } from './crew.contracts';
import { CrewService } from './crew.service';

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new BadRequestException(result.error.issues.map((issue) => `${issue.path.join('.') || 'request'}: ${issue.message}`));
  return result.data;
}

@Controller('crew')
export class CrewController {
  constructor(private readonly crew: CrewService) {}

  @Get(':id/health')
  getHealth(@Param('id') id: string) {
    return this.crew.getHealth(parse(z.string().uuid(), id));
  }

  @Post('checks')
  async submitCheck(@Body() body: unknown, @Headers('idempotency-key') key: unknown,
    @Res({ passthrough: true }) response: Response) {
    const payload = parse(dailyHealthCheckSchema, body);
    const result = await this.crew.submitCheck(payload, parse(idempotencyKeySchema, key));
    response.status(result.replay ? 200 : 201);
    return result.body;
  }
}
