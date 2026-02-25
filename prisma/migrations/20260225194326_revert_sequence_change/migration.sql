/*
  Warnings:

  - You are about to drop the column `skillSequence` on the `skill_groups` table. All the data in the column will be lost.
  - You are about to drop the column `groupSequence` on the `skill_packages` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "skill_groups" DROP COLUMN "skillSequence",
ADD COLUMN     "sequence" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "skill_packages" DROP COLUMN "groupSequence";

-- AlterTable
ALTER TABLE "skills" ADD COLUMN     "sequence" INTEGER NOT NULL DEFAULT 0;
