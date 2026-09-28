-- DropForeignKey
ALTER TABLE "skill_checks" DROP CONSTRAINT "skill_checks_assessorId_fkey";

-- AlterTable
ALTER TABLE "skill_checks" ADD COLUMN     "assessorLabel" TEXT,
ALTER COLUMN "assessorId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "skill_checks" ADD CONSTRAINT "skill_checks_assessorId_fkey" FOREIGN KEY ("assessorId") REFERENCES "personnel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
