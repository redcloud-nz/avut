-- AlterTable
ALTER TABLE "skill_check_sessions" ADD COLUMN     "teamId" TEXT;

-- CreateIndex
CREATE INDEX "skill_check_sessions_teamId_idx" ON "skill_check_sessions"("teamId");

-- AddForeignKey
ALTER TABLE "skill_check_sessions" ADD CONSTRAINT "skill_check_sessions_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;
