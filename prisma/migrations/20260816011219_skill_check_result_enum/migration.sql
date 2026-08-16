/*
  Warnings:

  - Changed the type of `result` on the `skill_checks` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "SkillCheckResult" AS ENUM ('NotTaught', 'LowFail', 'Fail', 'HighFail', 'WeakPass', 'Pass', 'StrongPass', 'Exempt', 'Expired', 'Provisional');

-- AlterTable
ALTER TABLE "skill_checks" DROP COLUMN "result",
ADD COLUMN     "result" "SkillCheckResult" NOT NULL;
