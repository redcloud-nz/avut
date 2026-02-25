/*
  Warnings:

  - You are about to drop the column `parentGroupId` on the `skill_groups` table. All the data in the column will be lost.
  - You are about to drop the column `sequence` on the `skill_groups` table. All the data in the column will be lost.
  - You are about to drop the column `sequence` on the `skills` table. All the data in the column will be lost.
  - Made the column `skillGroupId` on table `skills` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "skill_groups" DROP CONSTRAINT "skill_groups_parentGroupId_fkey";

-- AlterTable
ALTER TABLE "skill_groups" DROP COLUMN "parentGroupId",
DROP COLUMN "sequence",
ADD COLUMN     "skillSequence" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "skill_packages" ADD COLUMN     "groupSequence" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "published" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "skills" DROP COLUMN "sequence",
ALTER COLUMN "skillGroupId" SET NOT NULL;
