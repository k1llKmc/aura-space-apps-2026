-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "DataSourceType" AS ENUM ('AUTO_TELEMETRY', 'MANUAL_REPORT', 'DIAGNOSTIC_DEVICE');

-- CreateEnum
CREATE TYPE "HazardType" AS ENUM ('SPACE_RADIATION', 'ALTERED_GRAVITY', 'ISOLATION_CONFINEMENT', 'DISTANCE_FROM_EARTH', 'HOSTILE_ENVIRONMENT');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('NOMINAL', 'ATTENTION', 'CRITICAL', 'OUTDATED');

-- CreateEnum
CREATE TYPE "BodyZone" AS ENUM ('HEAD_EYES', 'CHEST_CARDIO', 'ABDOMEN_METABOLISM', 'WHOLE_BODY_IMMUNE', 'SKELETON_MUSCLES');

-- CreateTable
CREATE TABLE "Mission" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "missionDay" INTEGER NOT NULL,
    "commDelaySeconds" INTEGER NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Mission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrewMember" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "photoUrl" TEXT,
    "age" INTEGER NOT NULL,
    "status" "AlertSeverity" NOT NULL DEFAULT 'NOMINAL',
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrewMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndividualBaseline" (
    "id" TEXT NOT NULL,
    "crewMemberId" TEXT NOT NULL,
    "zone" "BodyZone" NOT NULL,
    "baselineData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IndividualBaseline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthRecord" (
    "id" TEXT NOT NULL,
    "crewMemberId" TEXT NOT NULL,
    "sourceType" "DataSourceType" NOT NULL,
    "zone" "BodyZone",
    "metrics" JSONB NOT NULL,
    "symptoms" TEXT[],
    "isOutdated" BOOLEAN NOT NULL DEFAULT false,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HealthRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnvironmentRecord" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "radiationCans" DOUBLE PRECISION NOT NULL,
    "totalRadiation" DOUBLE PRECISION NOT NULL,
    "pO2" DOUBLE PRECISION NOT NULL,
    "co2Ppm" DOUBLE PRECISION NOT NULL,
    "cabinPressure" DOUBLE PRECISION NOT NULL,
    "temperature" DOUBLE PRECISION NOT NULL,
    "humidity" DOUBLE PRECISION NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnvironmentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "crewMemberId" TEXT,
    "hazardType" "HazardType" NOT NULL,
    "severity" "AlertSeverity" NOT NULL DEFAULT 'ATTENTION',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CountermeasureProtocol" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "hazard" "HazardType" NOT NULL,
    "description" TEXT NOT NULL,
    "steps" TEXT[],

    CONSTRAINT "CountermeasureProtocol_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Mission_name_key" ON "Mission"("name");

-- CreateIndex
CREATE INDEX "CrewMember_missionId_idx" ON "CrewMember"("missionId");

-- CreateIndex
CREATE INDEX "IndividualBaseline_crewMemberId_zone_idx" ON "IndividualBaseline"("crewMemberId", "zone");

-- CreateIndex
CREATE INDEX "HealthRecord_crewMemberId_recordedAt_idx" ON "HealthRecord"("crewMemberId", "recordedAt");

-- CreateIndex
CREATE INDEX "EnvironmentRecord_missionId_recordedAt_idx" ON "EnvironmentRecord"("missionId", "recordedAt");

-- CreateIndex
CREATE INDEX "Alert_missionId_severity_idx" ON "Alert"("missionId", "severity");

-- CreateIndex
CREATE UNIQUE INDEX "CountermeasureProtocol_title_key" ON "CountermeasureProtocol"("title");

-- AddForeignKey
ALTER TABLE "CrewMember" ADD CONSTRAINT "CrewMember_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndividualBaseline" ADD CONSTRAINT "IndividualBaseline_crewMemberId_fkey" FOREIGN KEY ("crewMemberId") REFERENCES "CrewMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthRecord" ADD CONSTRAINT "HealthRecord_crewMemberId_fkey" FOREIGN KEY ("crewMemberId") REFERENCES "CrewMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnvironmentRecord" ADD CONSTRAINT "EnvironmentRecord_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_crewMemberId_fkey" FOREIGN KEY ("crewMemberId") REFERENCES "CrewMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
