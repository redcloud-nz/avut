/*
  Warnings:

  - You are about to drop the column `type` on the `teams` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "teams" DROP COLUMN "type";

-- CreateTable
CREATE TABLE "team_d4h" (
    "teamId" TEXT NOT NULL,
    "d4hTeamId" INTEGER NOT NULL,
    "d4hTeamName" TEXT NOT NULL,
    "d4hServer" TEXT NOT NULL,
    "d4hLastSyncAt" TIMESTAMP(3) NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "team_d4h_teamId_key" ON "team_d4h"("teamId");

-- AddForeignKey
ALTER TABLE "team_d4h" ADD CONSTRAINT "team_d4h_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
