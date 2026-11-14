import { AlertSeverity } from '@prisma/client';

export type MissionStatusResponse = {
  missionId: string;
  name: string;
  destination: string;
  phase: string;
  missionDay: number;
  commDelaySeconds: number;
  commDelayFormatted: string;
  environment: {
    radiationCans: number;
    totalRadiation: number;
    pO2: number;
    co2Ppm: number;
    cabinPressure: number;
    temperature: number;
    humidity: number;
    status: AlertSeverity;
  };
  hazardsStatus: Record<'spaceRadiation' | 'alteredGravity' | 'isolationConfinement' | 'distanceFromEarth' | 'hostileEnvironment', AlertSeverity>;
};
