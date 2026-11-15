import { Body, Controller, Get, Headers, Param, Post, Res, Req, Query } from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import { dailyHealthCheckSchema, idempotencyKeySchema } from './crew.contracts';
import { CrewService } from './crew.service';
import { parse, pagination } from '../../common/validation';
import { AuthService } from '../auth/auth.service';
import type { AuthRequest } from '../auth/auth.guard';


@Controller('crew')
export class CrewController {
  constructor(private readonly crew: CrewService, private readonly auth: AuthService) {}

  @Get()
  list(@Query() query: unknown, @Req() request: AuthRequest) {
    return this.crew.list(request.user, parse(pagination.strict(), query));
  }

  @Get(':id/health')
  async getHealth(@Param('id') id: string, @Req() request: AuthRequest) {
    await this.auth.requireCrew(parse(z.string().uuid(), id), request.user);
    return this.crew.getHealth(parse(z.string().uuid(), id));
  }

  @Post('checks')
  async submitCheck(@Body() body: unknown, @Headers('idempotency-key') key: unknown,
    @Res({ passthrough: true }) response: Response, @Req() request: AuthRequest) {
    const payload = parse(dailyHealthCheckSchema, body);
    await this.auth.requireCrew(payload.crewMemberId, request.user);
    const result = await this.crew.submitCheck(payload, parse(idempotencyKeySchema, key), request.user);
    response.status(result.replay ? 200 : 201);
    return result.body;
  }
}
