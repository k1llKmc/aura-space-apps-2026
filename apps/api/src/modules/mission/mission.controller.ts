import { Controller, Get } from '@nestjs/common';
import { MissionService } from './mission.service';
import type { MissionStatusResponse } from './mission.types';

@Controller('missions')
export class MissionController {
  constructor(private readonly missionService: MissionService) {}

  @Get('current')
  getCurrentStatus(): Promise<MissionStatusResponse> {
    return this.missionService.getCurrentStatus();
  }
}
