-- AlterTable
ALTER TABLE "skill_checks" ADD COLUMN     "sessionId" TEXT;

-- AddForeignKey
ALTER TABLE "skill_checks" ADD CONSTRAINT "skill_checks_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "skill_check_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
