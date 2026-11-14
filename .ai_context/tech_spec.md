# AURA (Astronaut Unified Risk Assessment) — Technical Specification

**Version:** 2.0 (NASA/CSA Validated)

**Role:** Principal Systems Architect & Tech Lead

**Target Environment:** Autonomous Spacecraft Edge Node & Mission Control Center

## 1. Technology Stack

To ensure high reliability, full autonomy under communication latency ($5–20$ min), and high UI responsiveness for simulation modules, the following technology stack has been selected:

* **Frontend:** **Next.js (React / TypeScript / Tailwind CSS)**

  * *Rationale:* Provides hybrid rendering (SSR/SSG/Client Components), which is critical for low-latency boot times on spacecraft terminals. TypeScript enforces strict typing for complex medical data structures. Tailwind CSS enables a responsive, clean aerospace-grade UI. The interactive SVG Body Map is implemented using native React components with optimized rendering states across $5$ distinct anatomical zones.

* **Backend:** **NestJS (Node.js / TypeScript)**

  * *Rationale:* NestJS's modular architecture is ideally suited for scalable systems featuring complex business logic (risk assessment, telemetry streams, simulation engine). Strict Dependency Injection (DI), decorator-based architecture, and built-in validation via `class-validator` minimize integration errors at API boundaries.

* **Database:** **PostgreSQL 16**

  * *Rationale:* A robust relational DBMS featuring powerful JSONB support. This allows storing structured relational entities (crew members, missions, protocols) alongside flexible, high-frequency telemetry streams (CANS spectrometer telemetry, atmospheric gas analyzers, simulation metadata) within a single ACID-compliant system.

* **Caching & Message Queue:** **Redis & BullMQ**

  * *Rationale:* Caching active mission states and environmental parameters (`Mission Control`) for instantaneous access without database contention. BullMQ handles asynchronous compute jobs for the `Mission Risk Simulator` scenarios and background worker tasks (e.g., checking for outdated data timestamps where `Outdated Data Check > 7 days`).

* **Deployment & Infrastructure:** **Docker & Docker Compose (Edge-First Architecture)**

  * *Rationale:* Because AURA is deployed directly on-board spacecraft hardware as an autonomous edge server operating under potential terrestrial isolation, complete containerization via Docker Compose ensures rapid orchestration of the entire stack (Frontend, Backend, PostgreSQL, Redis) with zero external cloud dependencies.

## 2. Project Structure (Folder & File Structure)

The project is structured as a monorepo utilizing workspace management (`npm workspaces` or Turborepo) to facilitate shared types and interface contracts between client and server applications.

```
aura-project/
├── apps/
│   ├── web/                     # Frontend (Next.js 15)
│   │   ├── public/              # Static assets, icons, SVG body maps
│   │   ├── src/
│   │   │   ├── app/             # App Router (mission-control, crew, simulator, countermeasures)
│   │   │   ├── components/      # UI Components (BodyMap, RiskMatrix, CommDelayBadge, Badges)
│   │   │   ├── hooks/           # Custom React hooks (useTelemetry, useSimulation)
│   │   │   └── services/        # API clients (Axios / Fetch wrappers)
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── api/                     # Backend (NestJS)
│       ├── src/
│       │   ├── modules/
│       │   │   ├── mission/     # Mission status & Comm Delay management
│       │   │   ├── crew/        # Crew profiles & Individual Baseline management
│       │   │   ├── telemetry/   # Data ingestion ([AUTO], [MANUAL], [DEVICE])
│       │   │   ├── simulator/   # What-if scenario modeling engine
│       │   │   └── alerts/      # Alert generation and escalation pipeline
│       │   ├── prisma/          # Prisma Client singleton
│       │   ├── app.module.ts
│       │   └── main.ts
│       ├── package.json
│       └── tsconfig.json
│
├── packages/
│   └── shared-types/            # Shared TypeScript interfaces & DTO request/response contracts
│       ├── src/
│       │   ├── index.ts
│       │   └── api.types.ts
│       └── package.json
│
├── docker-compose.yml           # Edge server service orchestration
├── package.json
└── README.md
```

## 3. Database Schema

The complete relational schema defined via **Prisma Schema** (`schema.prisma`) covers all core entities of the AURA system, including support for data source provenance tags, the $5$ NASA Hazards, and individual pre-flight baseline comparisons.

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum DataSourceType {
  AUTO_TELEMETRY
  MANUAL_REPORT
  DIAGNOSTIC_DEVICE
}

enum HazardType {
  SPACE_RADIATION
  ALTERED_GRAVITY
  ISOLATION_CONFINEMENT
  DISTANCE_FROM_EARTH
  HOSTILE_ENVIRONMENT
}

enum AlertSeverity {
  NOMINAL
  ATTENTION
  CRITICAL
  OUTDATED
}

enum BodyZone {
  HEAD_EYES
  CHEST_CARDIO
  ABDOMEN_METABOLISM
  WHOLE_BODY_IMMUNE
  SKELETON_MUSCLES
}

model Mission {
  id                String              @id @default(uuid())
  name              String              @unique // e.g., "Mars Transit 2026"
  destination       String              // e.g., "Mars"
  phase             String              // e.g., "Cruise Phase"
  missionDay        Int                 // Current mission elapsed day
  commDelaySeconds  Int                 // Communication delay in seconds (e.g., 720 for 12 min)
  createdAt         DateTime            @default(now())
  updatedAt         DateTime            @updatedAt
  
  crewMembers       CrewMember[]
  environmentLogs   EnvironmentRecord[]
  alerts            Alert[]
}

model CrewMember {
  id              String             @id @default(uuid())
  missionId       String
  mission         Mission            @relation(fields: [missionId], references: [id], onDelete: Cascade)
  name            String
  role            String             // e.g., "Commander", "Mission Specialist"
  photoUrl        String?
  age             Int
  status          AlertSeverity      @default(NOMINAL)
  lastSyncedAt    DateTime           @default(now())

  baselines       IndividualBaseline[]
  healthRecords   HealthRecord[]
  alerts          Alert[]

  @@index([missionId])
}

model IndividualBaseline {
  id             String      @id @default(uuid())
  crewMemberId   String
  crewMember     CrewMember  @relation(fields: [crewMemberId], references: [id], onDelete: Cascade)
  zone           BodyZone
  baselineData   Json        // Pre-flight baseline reference metrics
  createdAt      DateTime    @default(now())

  @@index([crewMemberId, zone])
}

model HealthRecord {
  id             String            @id @default(uuid())
  crewMemberId   String
  crewMember     CrewMember        @relation(fields: [crewMemberId], references: [id], onDelete: Cascade)
  sourceType     DataSourceType    // [AUTO], [MANUAL], [DIAGNOSTIC_DEVICE]
  zone           BodyZone?
  metrics        Json              // Dynamic metrics (Heart Rate, sleep, OCT scans, stress 1-10)
  symptoms       String[]          // Logged physiological symptoms
  isOutdated     Boolean           @default(false) // Stale data flag (> 7 days without check)
  recordedAt     DateTime          @default(now())

  @@index([crewMemberId, recordedAt])
}

model EnvironmentRecord {
  id             String      @id @default(uuid())
  missionId      String
  mission        Mission     @relation(fields: [missionId], references: [id], onDelete: Cascade)
  radiationCans  Float       // Neutron spectrometer CANS (mSv/day)
  totalRadiation Float       // Total ionizing radiation dose
  pO2            Float       // Partial oxygen pressure (kPa)
  co2Ppm         Float       // Carbon dioxide concentration (ppm)
  cabinPressure  Float       // Total barometric cabin pressure
  temperature    Float       // Ambient temperature (°C)
  humidity       Float       // Relative humidity (%)
  recordedAt     DateTime    @default(now())

  @@index([missionId, recordedAt])
}

model Alert {
  id             String         @id @default(uuid())
  missionId      String
  mission        Mission        @relation(fields: [missionId], references: [id], onDelete: Cascade)
  crewMemberId   String?
  crewMember     CrewMember?    @relation(fields: [crewMemberId], references: [id], onDelete: Cascade)
  hazardType     HazardType
  severity       AlertSeverity  @default(ATTENTION)
  title          String
  message        String
  isResolved     Boolean        @default(false)
  createdAt      DateTime       @default(now())

  @@index([missionId, severity])
}

model CountermeasureProtocol {
  id          String     @id @default(uuid())
  title       String     // e.g., "Thigh Cuffs Protocol", "ARED Training"
  hazard      HazardType
  description String
  steps       String[]   // Actionable crew guidance steps
}
```

## 4. API Endpoints & Contracts

The core REST API endpoints implemented on the backend are specified below, including HTTP methods, paths, request/response payload schemas, and standard error handling codes.

### 4.1. Fetch Mission Control Status

* **Method & Path:** `GET /api/v1/missions/current`

* **Request Body:** `None`

* **Response Body (200 OK):**

```json
{
  "missionId": "m-uuid-1234",
  "name": "Mars Transit 2026",
  "destination": "Mars",
  "phase": "Cruise Phase",
  "missionDay": 42,
  "commDelaySeconds": 720,
  "commDelayFormatted": "00:12:00",
  "environment": {
    "radiationCans": 1.42,
    "totalRadiation": 3.85,
    "pO2": 21.3,
    "co2Ppm": 540,
    "cabinPressure": 101.3,
    "temperature": 22.4,
    "humidity": 45.0,
    "status": "NOMINAL"
  },
  "hazardsStatus": {
    "spaceRadiation": "NOMINAL",
    "alteredGravity": "ELEVATED",
    "isolationConfinement": "ATTENTION",
    "distanceFromEarth": "NOMINAL",
    "hostileEnvironment": "NOMINAL"
  }
}
```

### 4.2. Fetch Crew Profile and Body Map Data

* **Method & Path:** `GET /api/v1/crew/:id/health`

* **Request Body:** `None`

* **Response Body (200 OK):**

```json
{
  "crewMemberId": "crew-uuid-789",
  "name": "Cmdr. Alex Mercer",
  "role": "Commander",
  "overallStatus": "ATTENTION",
  "zones": [
    {
      "zone": "HEAD_EYES",
      "status": "OUTDATED",
      "lastChecked": "2026-03-01T10:00:00Z",
      "isOutdated": true,
      "message": "Data outdated (>7 days). Scheduled Ultrasound/OCT examination required.",
      "sourceType": "DIAGNOSTIC_DEVICE"
    },
    {
      "zone": "CHEST_CARDIO",
      "status": "NOMINAL",
      "lastChecked": "2026-03-08T08:30:00Z",
      "isOutdated": false,
      "metrics": {
        "heartRateResting": 62,
        "bloodPressure": "120/80"
      },
      "sourceType": "AUTO_TELEMETRY"
    }
  ]
}
```

### 4.3. Submit Daily Health Check

* **Method & Path:** `POST /api/v1/crew/checks`

* **Request Body (JSON):**

```json
{
  "crewMemberId": "crew-uuid-789",
  "sourceType": "MANUAL_REPORT",
  "moodScore": 8,
  "stressScore": 3,
  "fatigueScore": 4,
  "sleepHours": 7.5,
  "symptoms": ["mild_eye_strain"],
  "notes": "Stable sleep pattern, minor fatigue toward the end of the shift."
}
```

* **Response Body (201 Created):**

```json
{
  "success": true,
  "checkId": "chk-uuid-999",
  "xpEarned": 50,
  "currentStreak": 12,
  "message": "Daily check successfully logged. Awarded 50 XP for consistency."
}
```

### 4.4. Run What-If Simulation (Mission Risk Simulator)

* **Method & Path:** `POST /api/v1/simulator/run`

* **Request Body (JSON):**

```json
{
  "scenarioType": "SOLAR_RADIATION_STORM",
  "parameters": {
    "radiationMultiplier": 4.5,
    "cansSpike": true,
    "gravityLevel": 0.0,
    "countermeasuresActive": true,
    "selectedCountermeasure": "THIGH_CUFFS_AND_B_COMPLEX"
  }
}
```

* **Response Body (200 OK):**

```json
{
  "simulationId": "sim-uuid-555",
  "predictedImpacts": {
    "dnaRadiationRisk": "ELEVATED",
    "sansRiskShift": "MITIGATED",
    "cognitivePerformance": "STABLE"
  },
  "affectedZones": ["HEAD_EYES", "WHOLE_BODY_IMMUNE"],
  "recommendedProtocolId": "proto-uuid-01",
  "recommendationText": "Apply lower body negative pressure (Thigh Cuffs) and administer B-Complex vitamin supplements."
}
```

### 4.5. Standard API Error Codes

All endpoints return a standardized JSON error envelope upon failure:

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": ["Invalid parameter format for simulation payload"],
  "timestamp": "2026-03-08T22:00:00.000Z"
}
```

* **400 Bad Request:** Payload validation failure (enforced via Zod / class-validator).

* **401 Unauthorized:** Missing or invalid on-board astronaut authentication JWT token.

* **403 Forbidden:** Insufficient permission levels to perform the requested operation (e.g., attempting mission parameter reconfiguration without Commander privileges).

* **404 Not Found:** Requested resource (crew member, mission, or simulation scenario) not found in the database.

* **500 Internal Server Error:** Unexpected on-board server fault (database connection loss or background worker failure in BullMQ).
