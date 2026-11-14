import { AlertSeverity, BodyZone, DataSourceType } from './models';

export interface ApiErrorResponse { statusCode: number; error: string; message: string[]; timestamp: string; }
export interface MissionEnvironment { radiationCans: number; totalRadiation: number; pO2: number; co2Ppm: number; cabinPressure: number; temperature: number; humidity: number; status: AlertSeverity; }
export interface MissionStatusResponse { missionId: string; name: string; destination: string; phase: string; missionDay: number; commDelaySeconds: number; commDelayFormatted: string; environment: MissionEnvironment; hazardsStatus: { spaceRadiation: AlertSeverity; alteredGravity: AlertSeverity; isolationConfinement: AlertSeverity; distanceFromEarth: AlertSeverity; hostileEnvironment: AlertSeverity; }; }
export interface HealthZoneStatus { zone: BodyZone; status: AlertSeverity; lastChecked: string; isOutdated: boolean; message?: string; metrics?: Record<string, unknown>; sourceType: DataSourceType; }
export interface CrewHealthResponse { crewMemberId: string; name: string; role: string; overallStatus: AlertSeverity; zones: HealthZoneStatus[]; }
export interface DailyHealthCheckRequest { crewMemberId: string; sourceType: DataSourceType.MANUAL_REPORT; moodScore: number; stressScore: number; fatigueScore: number; sleepHours: number; symptoms: string[]; notes: string; }
export interface DailyHealthCheckResponse { success: true; checkId: string; xpEarned: number; currentStreak: number; message: string; }
export interface SimulationRequest { scenarioType: string; parameters: { radiationMultiplier: number; cansSpike: boolean; gravityLevel: number; countermeasuresActive: boolean; selectedCountermeasure: string; }; }
export interface SimulationResponse { simulationId: string; predictedImpacts: Record<string, string>; affectedZones: BodyZone[]; recommendedProtocolId: string; recommendationText: string; }
