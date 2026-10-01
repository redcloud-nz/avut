-- AlterEnum
-- Nothing below may use the new values: Postgres forbids using an enum value in the transaction
-- that adds it.
ALTER TYPE "SkillCheckStatus" ADD VALUE 'Pending';
ALTER TYPE "SkillCheckStatus" ADD VALUE 'Deleted';

-- AlterTable
-- Added nullable, backfilled from "createdAt", then made NOT NULL.
ALTER TABLE "skill_checks" ADD COLUMN     "updatedAt" TIMESTAMP(3);

UPDATE "skill_checks" SET "updatedAt" = "createdAt";

ALTER TABLE "skill_checks" ALTER COLUMN "updatedAt" SET NOT NULL;
