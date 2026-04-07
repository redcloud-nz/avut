/*
  Warnings:

  - You are about to drop the column `endedAt` on the `skill_check_sessions` table. All the data in the column will be lost.
  - You are about to drop the column `startedAt` on the `skill_check_sessions` table. All the data in the column will be lost.
  - Added the required column `name` to the `skill_check_sessions` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "skill_check_sessions" DROP COLUMN "endedAt",
DROP COLUMN "startedAt",
ADD COLUMN     "endsAt" TIMESTAMP(3),
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "startsAt" TIMESTAMP(3);
