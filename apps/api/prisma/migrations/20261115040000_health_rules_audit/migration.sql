ALTER TABLE "HealthRecord" ADD COLUMN "units" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "Alert" ADD COLUMN "zone" "BodyZone", ADD COLUMN "origin" TEXT NOT NULL DEFAULT 'OPERATOR', ADD COLUMN "dedupKey" TEXT;
CREATE UNIQUE INDEX "Alert_dedupKey_key" ON "Alert"("dedupKey");
CREATE TABLE "ZoneState" (
  "id" TEXT NOT NULL, "crewMemberId" TEXT NOT NULL, "zone" "BodyZone" NOT NULL,
  "result" JSONB NOT NULL, "evaluatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ZoneState_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ZoneState_crewMemberId_zone_key" ON "ZoneState"("crewMemberId", "zone");
ALTER TABLE "ZoneState" ADD CONSTRAINT "ZoneState_crewMemberId_fkey" FOREIGN KEY ("crewMemberId") REFERENCES "CrewMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE TABLE "AuditEvent" (
  "id" TEXT NOT NULL, "missionId" TEXT NOT NULL, "crewMemberId" TEXT, "actorId" TEXT,
  "action" TEXT NOT NULL, "entityId" TEXT, "details" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AuditEvent_missionId_createdAt_idx" ON "AuditEvent"("missionId", "createdAt");
CREATE INDEX "AuditEvent_crewMemberId_createdAt_idx" ON "AuditEvent"("crewMemberId", "createdAt");
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_crewMemberId_fkey" FOREIGN KEY ("crewMemberId") REFERENCES "CrewMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
