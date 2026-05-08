/*
  Warnings:

  - A unique constraint covering the columns `[assesseeId,assessorId,sessionId,skillId]` on the table `skill_checks` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "skill_checks_assesseeId_sessionId_skillId_key";

-- CreateIndex
CREATE UNIQUE INDEX "skill_checks_assesseeId_assessorId_sessionId_skillId_key" ON "skill_checks"("assesseeId", "assessorId", "sessionId", "skillId");
