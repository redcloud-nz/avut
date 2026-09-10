/*
  Warnings:

  - You are about to drop the column `d4hLastSyncedAt` on the `team_d4h` table. All the data in the column will be lost.
  - You are about to drop the column `d4hServer` on the `team_d4h` table. All the data in the column will be lost.
  - Added the required column `d4hServerCode` to the `team_d4h` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "team_d4h" DROP COLUMN "d4hLastSyncedAt",
DROP COLUMN "d4hServer",
ADD COLUMN     "d4hOrganisationId" INTEGER,
ADD COLUMN     "d4hServerCode" TEXT NOT NULL,
ADD COLUMN     "d4hTimezone" TEXT,
ADD COLUMN     "lastSyncedAt" TIMESTAMP(3),
ADD COLUMN     "linkTokenId" TEXT;

-- AlterTable
ALTER TABLE "team_memberships" ADD COLUMN     "status" "RecordStatus" NOT NULL DEFAULT 'Active';

-- DropEnum
DROP TYPE "TeamType";

-- CreateTable
CREATE TABLE "organization_d4h" (
    "organizationId" TEXT NOT NULL,
    "serverCode" TEXT NOT NULL,
    "d4hOrganisationId" INTEGER,
    "d4hOrganisationName" TEXT,
    "d4hTimezone" TEXT,
    "d4hCurrency" TEXT,
    "d4hReportingStartDay" INTEGER,
    "d4hReportingStartMonth" INTEGER,
    "syncTokenId" TEXT,
    "lastSyncedAt" TIMESTAMP(3)
);

-- CreateTable
CREATE TABLE "team_membership_d4h" (
    "teamMembershipId" TEXT NOT NULL,
    "d4hMemberId" INTEGER NOT NULL,
    "d4hStatus" TEXT NOT NULL,
    "d4hPosition" TEXT,
    "d4hRef" TEXT,
    "d4hRoleId" INTEGER
);

-- CreateIndex
CREATE UNIQUE INDEX "organization_d4h_organizationId_key" ON "organization_d4h"("organizationId");

-- CreateIndex
CREATE INDEX "team_membership_d4h_d4hMemberId_idx" ON "team_membership_d4h"("d4hMemberId");

-- CreateIndex
CREATE UNIQUE INDEX "team_membership_d4h_teamMembershipId_key" ON "team_membership_d4h"("teamMembershipId");

-- CreateIndex
CREATE INDEX "team_memberships_teamId_status_idx" ON "team_memberships"("teamId", "status");

-- AddForeignKey
ALTER TABLE "organization_d4h" ADD CONSTRAINT "organization_d4h_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_d4h" ADD CONSTRAINT "organization_d4h_syncTokenId_fkey" FOREIGN KEY ("syncTokenId") REFERENCES "d4h_access_tokens"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_d4h" ADD CONSTRAINT "team_d4h_linkTokenId_fkey" FOREIGN KEY ("linkTokenId") REFERENCES "d4h_access_tokens"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_membership_d4h" ADD CONSTRAINT "team_membership_d4h_teamMembershipId_fkey" FOREIGN KEY ("teamMembershipId") REFERENCES "team_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;
