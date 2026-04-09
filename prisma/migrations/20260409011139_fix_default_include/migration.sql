/*
  Warnings:

  - You are about to drop the column `defaultIncluded` on the `skill_groups` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "skill_groups" DROP COLUMN "defaultIncluded",
ADD COLUMN     "defaultInclude" BOOLEAN NOT NULL DEFAULT true;
