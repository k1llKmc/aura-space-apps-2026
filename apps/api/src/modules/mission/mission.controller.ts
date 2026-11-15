import { Controller, Get, Req } from '@nestjs/common';
import type { AuthRequest } from '../auth/auth.guard';
import { MissionService } from './mission.service';
import type { MissionStatusResponse } from './mission.types';

@Controller('missions')
export class MissionController {
  constructor(private readonly missionService: MissionService) {}

  @Get('current')
  getCurrentStatus(@Req() request: AuthRequest): Promise<MissionStatusResponse> {
    return this.missionService.getCurrentStatus(request.user.missionId);
  }
}
