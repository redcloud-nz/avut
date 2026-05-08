/*
  Warnings:

  - A unique constraint covering the columns `[assesseeId,sessionId,skillId]` on the table `skill_checks` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE INDEX "skill_checks_sessionId_idx" ON "skill_checks"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "skill_checks_assesseeId_sessionId_skillId_key" ON "skill_checks"("assesseeId", "sessionId", "skillId");
