export enum DataSourceType { AUTO_TELEMETRY = 'AUTO_TELEMETRY', MANUAL_REPORT = 'MANUAL_REPORT', DIAGNOSTIC_DEVICE = 'DIAGNOSTIC_DEVICE' }
export enum HazardType { SPACE_RADIATION = 'SPACE_RADIATION', ALTERED_GRAVITY = 'ALTERED_GRAVITY', ISOLATION_CONFINEMENT = 'ISOLATION_CONFINEMENT', DISTANCE_FROM_EARTH = 'DISTANCE_FROM_EARTH', HOSTILE_ENVIRONMENT = 'HOSTILE_ENVIRONMENT' }
export enum AlertSeverity { NOMINAL = 'NOMINAL', ATTENTION = 'ATTENTION', CRITICAL = 'CRITICAL', OUTDATED = 'OUTDATED' }
export enum BodyZone { HEAD_EYES = 'HEAD_EYES', CHEST_CARDIO = 'CHEST_CARDIO', ABDOMEN_METABOLISM = 'ABDOMEN_METABOLISM', WHOLE_BODY_IMMUNE = 'WHOLE_BODY_IMMUNE', SKELETON_MUSCLES = 'SKELETON_MUSCLES' }

export type JsonObject = Record<string, unknown>;
export interface Mission { id: string; name: string; destination: string; phase: string; missionDay: number; commDelaySeconds: number; isCurrent: boolean; createdAt: string; updatedAt: string; }
export interface CrewMember { id: string; missionId: string; name: string; role: string; photoUrl: string | null; age: number; status: AlertSeverity; lastSyncedAt: string; }
export interface IndividualBaseline { id: string; crewMemberId: string; zone: BodyZone; baselineData: JsonObject; createdAt: string; }
export interface HealthRecord { id: string; crewMemberId: string; sourceType: DataSourceType; zone: BodyZone | null; metrics: JsonObject; symptoms: string[]; isOutdated: boolean; recordedAt: string; }
export interface EnvironmentRecord { id: string; missionId: string; radiationCans: number; totalRadiation: number; pO2: number; co2Ppm: number; cabinPressure: number; temperature: number; humidity: number; recordedAt: string; }
export interface Alert { id: string; missionId: string; crewMemberId: string | null; hazardType: HazardType; severity: AlertSeverity; title: string; message: string; isResolved: boolean; createdAt: string; }
export interface CountermeasureProtocol { id: string; title: string; hazard: HazardType; description: string; steps: string[]; }
