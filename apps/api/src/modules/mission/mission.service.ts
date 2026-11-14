import { Injectable, NotFoundException } from '@nestjs/common';
import { AlertSeverity, HazardType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { MissionStatusResponse } from './mission.types';

const hazardKeys: Record<HazardType, keyof MissionStatusResponse['hazardsStatus']> = {
  SPACE_RADIATION: 'spaceRadiation',
  ALTERED_GRAVITY: 'alteredGravity',
  ISOLATION_CONFINEMENT: 'isolationConfinement',
  DISTANCE_FROM_EARTH: 'distanceFromEarth',
  HOSTILE_ENVIRONMENT: 'hostileEnvironment',
};
const severityWeight: Record<AlertSeverity, number> = { NOMINAL: 0, ATTENTION: 1, OUTDATED: 2, CRITICAL: 3 };

@Injectable()
export class MissionService {
  constructor(private readonly prisma: PrismaService) {}

  async getCurrentStatus(): Promise<MissionStatusResponse> {
    const mission = await this.prisma.mission.findFirst({
      where: { isCurrent: true },
      include: {
        environmentLogs: { orderBy: { recordedAt: 'desc' }, take: 1 },
        alerts: { where: { isResolved: false }, select: { hazardType: true, severity: true } },
      },
    });
    if (!mission) throw new NotFoundException('No current mission is configured.');
    const environment = mission.environmentLogs[0];
    if (!environment) throw new NotFoundException(`No environmental records are available for mission ${mission.id}.`);

    const hazardsStatus: MissionStatusResponse['hazardsStatus'] = {
      spaceRadiation: AlertSeverity.NOMINAL, alteredGravity: AlertSeverity.NOMINAL, isolationConfinement: AlertSeverity.NOMINAL, distanceFromEarth: AlertSeverity.NOMINAL, hostileEnvironment: AlertSeverity.NOMINAL,
    };
    for (const alert of mission.alerts) {
      const key = hazardKeys[alert.hazardType];
      if (severityWeight[alert.severity] > severityWeight[hazardsStatus[key]]) hazardsStatus[key] = alert.severity;
    }
    const environmentStatus = hazardsStatus.spaceRadiation;
    return {
      missionId: mission.id, name: mission.name, destination: mission.destination, phase: mission.phase,
      missionDay: mission.missionDay, commDelaySeconds: mission.commDelaySeconds,
      commDelayFormatted: this.formatDelay(mission.commDelaySeconds),
      environment: { radiationCans: environment.radiationCans, totalRadiation: environment.totalRadiation, pO2: environment.pO2, co2Ppm: environment.co2Ppm, cabinPressure: environment.cabinPressure, temperature: environment.temperature, humidity: environment.humidity, status: environmentStatus },
      hazardsStatus,
    };
  }

  private formatDelay(totalSeconds: number): string {
    const seconds = Math.max(0, totalSeconds);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return [hours, minutes, seconds % 60].map((value) => String(value).padStart(2, '0')).join(':');
  }
}
