CREATE TABLE "DailyHealthCheck" (
    "id" TEXT NOT NULL,
    "crewMemberId" TEXT NOT NULL,
    "checkDate" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "response" JSONB NOT NULL,
    "xpEarned" INTEGER NOT NULL,
    "currentStreak" INTEGER NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DailyHealthCheck_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DailyHealthCheck_crewMemberId_checkDate_key" ON "DailyHealthCheck"("crewMemberId", "checkDate");
CREATE UNIQUE INDEX "DailyHealthCheck_crewMemberId_idempotencyKey_key" ON "DailyHealthCheck"("crewMemberId", "idempotencyKey");
ALTER TABLE "DailyHealthCheck" ADD CONSTRAINT "DailyHealthCheck_crewMemberId_fkey" FOREIGN KEY ("crewMemberId") REFERENCES "CrewMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
