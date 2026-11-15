CREATE TYPE "TaskKind" AS ENUM ('TELEMETRY', 'HEALTH_RECHECK', 'SIMULATION');
CREATE TYPE "TaskState" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');
ALTER TABLE "EnvironmentRecord" ADD COLUMN "sourceType" "DataSourceType" NOT NULL DEFAULT 'AUTO_TELEMETRY';
CREATE TABLE "BackgroundTask" (
  "id" TEXT NOT NULL, "missionId" TEXT NOT NULL, "crewMemberId" TEXT, "requesterId" TEXT,
  "kind" "TaskKind" NOT NULL, "state" "TaskState" NOT NULL DEFAULT 'PENDING',
  "dedupKey" TEXT NOT NULL, "payloadHash" TEXT NOT NULL, "payload" JSONB NOT NULL,
  "result" JSONB, "errorCode" TEXT, "attempts" INTEGER NOT NULL DEFAULT 0,
  "generation" INTEGER NOT NULL DEFAULT 0, "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BackgroundTask_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BackgroundTask_dedupKey_key" ON "BackgroundTask"("dedupKey");
CREATE INDEX "BackgroundTask_state_publishedAt_idx" ON "BackgroundTask"("state", "publishedAt");
CREATE INDEX "BackgroundTask_missionId_createdAt_idx" ON "BackgroundTask"("missionId", "createdAt");
ALTER TABLE "BackgroundTask" ADD CONSTRAINT "BackgroundTask_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BackgroundTask" ADD CONSTRAINT "BackgroundTask_crewMemberId_fkey" FOREIGN KEY ("crewMemberId") REFERENCES "CrewMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BackgroundTask" ADD CONSTRAINT "BackgroundTask_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
