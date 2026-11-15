export const AlertSeverity = { NOMINAL: 'NOMINAL', ATTENTION: 'ATTENTION', CRITICAL: 'CRITICAL', OUTDATED: 'OUTDATED' } as const;
export type AlertSeverity = typeof AlertSeverity[keyof typeof AlertSeverity];
export const BodyZone = { HEAD_EYES: 'HEAD_EYES', CHEST_CARDIO: 'CHEST_CARDIO', ABDOMEN_METABOLISM: 'ABDOMEN_METABOLISM', WHOLE_BODY_IMMUNE: 'WHOLE_BODY_IMMUNE', SKELETON_MUSCLES: 'SKELETON_MUSCLES' } as const;
export type BodyZone = typeof BodyZone[keyof typeof BodyZone];
export const DataSourceType = { AUTO_TELEMETRY: 'AUTO_TELEMETRY', MANUAL_REPORT: 'MANUAL_REPORT', DIAGNOSTIC_DEVICE: 'DIAGNOSTIC_DEVICE' } as const;
export type DataSourceType = typeof DataSourceType[keyof typeof DataSourceType];
export const HazardType = { SPACE_RADIATION: 'SPACE_RADIATION', ALTERED_GRAVITY: 'ALTERED_GRAVITY', ISOLATION_CONFINEMENT: 'ISOLATION_CONFINEMENT', DISTANCE_FROM_EARTH: 'DISTANCE_FROM_EARTH', HOSTILE_ENVIRONMENT: 'HOSTILE_ENVIRONMENT' } as const;
export type HazardType = typeof HazardType[keyof typeof HazardType];
export const UserRole = { COMMANDER: 'COMMANDER', MEDICAL_OFFICER: 'MEDICAL_OFFICER', CREW_MEMBER: 'CREW_MEMBER' } as const;
export type UserRole = typeof UserRole[keyof typeof UserRole];
export type RiskStatus = Exclude<AlertSeverity, 'OUTDATED'>;
export type DataState = 'CURRENT' | 'STALE' | 'MISSING';
export const statusPriority: Record<AlertSeverity, number> = { NOMINAL: 0, OUTDATED: 1, ATTENTION: 2, CRITICAL: 3 };
export function aggregateStatus(statuses: AlertSeverity[]): AlertSeverity {
  return statuses.reduce<AlertSeverity>((result, status) => statusPriority[status] > statusPriority[result] ? status : result, 'NOMINAL');
}
export interface ApiErrorResponse { statusCode: number; error: string; message: string[]; timestamp: string; }
export interface AuthUser { id: string; username: string; role: UserRole; missionId: string; crewMemberId: string | null; }
export interface LoginRequest { username: string; password: string; }
export interface LoginResponse { accessToken: string; tokenType: 'Bearer'; expiresIn: number; user: AuthUser; }
export interface CreateUserRequest extends LoginRequest { role: UserRole; crewMemberId?: string; }
export interface HealthZoneStatus { zone: BodyZone; status: AlertSeverity; riskStatus: RiskStatus | null; dataState: DataState; lastChecked: string | null; isOutdated: boolean; sourceType: DataSourceType | null; metrics: Record<string, unknown> | null; message: string; recordId: string | null; baselineId: string | null; assessmentComplete: boolean; evidence: MetricEvidence[]; rulesVersion: 'baseline-v1'; }
export interface CrewHealthResponse { crewMemberId: string; name: string; role: string; evaluatedAt: string; overallStatus: AlertSeverity; hasOutdatedData: boolean; zones: HealthZoneStatus[]; }
export interface DailyHealthCheckRequest { crewMemberId: string; sourceType: 'MANUAL_REPORT'; moodScore: number; stressScore: number; fatigueScore: number; sleepHours: number; symptoms: string[]; notes: string; }
export interface DailyHealthCheckResponse { success: true; checkId: string; recordedAt: string; checkDate: string; xpEarned: number; currentStreak: number; message: string; }
export interface MissionEnvironment { radiationCans: number; totalRadiation: number; pO2: number; co2Ppm: number; cabinPressure: number; temperature: number; humidity: number; status: AlertSeverity; }
export interface MissionStatusResponse { missionId: string; name: string; destination: string; phase: string; missionDay: number; commDelaySeconds: number; commDelayFormatted: string; environment: MissionEnvironment; hazardsStatus: Record<'spaceRadiation' | 'alteredGravity' | 'isolationConfinement' | 'distanceFromEarth' | 'hostileEnvironment', AlertSeverity>; }
export interface CrewSummary { id: string; name: string; role: string; photoUrl: string | null; }
export interface AlertResponse { id: string; missionId: string; crewMemberId: string | null; hazardType: HazardType; severity: AlertSeverity; title: string; message: string; isResolved: boolean; createdAt: string; resolvedAt: string | null; resolvedById: string | null; resolutionNote: string | null; zone: BodyZone | null; origin: string; }
export interface ProtocolResponse { id: string; title: string; hazard: HazardType; description: string; steps: string[]; }
export interface ListResponse<T> { items: T[]; total: number; offset: number; limit: number; }
export interface ResolveAlertRequest { note: string; }
export interface SimulationRequest { scenarioType: string; parameters: { radiationMultiplier: number; cansSpike: boolean; gravityLevel: number; countermeasuresActive: boolean; selectedCountermeasure: string; }; }
export interface SimulationResponse { simulationId: string; predictedImpacts: Record<string, string>; affectedZones: BodyZone[]; recommendedProtocolId: string; recommendationText: string; }
export interface BaselineRule { metric: string; unit: string; baseline: number; comparison: 'ABSOLUTE' | 'PERCENT'; direction: 'INCREASE' | 'DECREASE' | 'BOTH'; attentionDelta: number; criticalDelta: number; allowedSources: DataSourceType[]; }
export interface BaselineRequest { zone: BodyZone; rules: BaselineRule[]; reason: string; }
export interface BaselineResponse { id: string; zone: BodyZone; createdAt: string; baselineData: unknown; }
export interface MetricEvidence { metric: string; unit: string; baseline: number; current: number | null; delta: number | null; comparison: 'ABSOLUTE' | 'PERCENT'; riskStatus: RiskStatus | null; reason: string; }
export interface HealthRecordRequest { zone: BodyZone; sourceType: DataSourceType; metrics: Record<string, number>; units: Record<string, string>; symptoms: string[]; recordedAt?: string; }
export interface HealthRecordResponse { id: string; zone: BodyZone | null; sourceType: DataSourceType; metrics: unknown; units: unknown; symptoms: string[]; recordedAt: string; isOutdated: boolean; }
export interface AuditEventResponse { id: string; actorId: string | null; actorUsername: string | null; crewMemberId: string | null; action: string; entityId: string | null; details: unknown; createdAt: string; }
export const zoneMetricCatalog: Record<BodyZone, Record<string, string>> = {
  HEAD_EYES: { intraocularPressure: 'mmHg', octRetinalThickness: 'um', visualAcuity: 'ratio' },
  CHEST_CARDIO: { heartRateResting: 'bpm', systolicPressure: 'mmHg', diastolicPressure: 'mmHg' },
  ABDOMEN_METABOLISM: { fastingGlucose: 'mmol/L', bodyMass: 'kg' },
  WHOLE_BODY_IMMUNE: { whiteBloodCells: '10^9/L', cReactiveProtein: 'mg/L' },
  SKELETON_MUSCLES: { muscleMass: 'kg', boneMineralDensity: 'g/cm2', spineTScore: 'score' },
};
