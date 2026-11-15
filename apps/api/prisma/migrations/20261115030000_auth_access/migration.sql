CREATE TYPE "UserRole" AS ENUM ('COMMANDER', 'MEDICAL_OFFICER', 'CREW_MEMBER');
CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "username" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "role" "UserRole" NOT NULL,
  "missionId" TEXT NOT NULL,
  "crewMemberId" TEXT,
  "tokenVersion" INTEGER NOT NULL DEFAULT 0,
  "disabled" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "User_crew_required" CHECK ("role" <> 'CREW_MEMBER' OR "crewMemberId" IS NOT NULL)
);
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE INDEX "User_missionId_idx" ON "User"("missionId");
ALTER TABLE "User" ADD CONSTRAINT "User_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_crewMemberId_fkey" FOREIGN KEY ("crewMemberId") REFERENCES "CrewMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Alert" ADD COLUMN "resolvedAt" TIMESTAMP(3), ADD COLUMN "resolvedById" TEXT, ADD COLUMN "resolutionNote" TEXT;
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
