/*
  Warnings:

  - You are about to drop the column `d4hTeams` on the `self_audit_campaigns` table. All the data in the column will be lost.
  - You are about to drop the column `d4hTeamId` on the `self_audit_requests` table. All the data in the column will be lost.
  - You are about to drop the column `d4hTeamTitle` on the `self_audit_requests` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[campaignId,d4hMemberId]` on the table `self_audit_requests` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `d4hTeamId` to the `self_audit_campaigns` table without a default value. This is not possible if the table is not empty.
  - Added the required column `d4hTeamName` to the `self_audit_campaigns` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `self_audit_campaigns` table without a default value. This is not possible if the table is not empty.
  - Added the required column `teamId` to the `self_audit_campaigns` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "SelfAuditDeliveryStatus" ADD VALUE 'Unsent';

-- DropIndex
DROP INDEX "self_audit_requests_campaignId_d4hTeamId_d4hMemberId_key";

-- AlterTable
ALTER TABLE "self_audit_campaigns" DROP COLUMN "d4hTeams",
ADD COLUMN     "d4hTeamId" INTEGER NOT NULL,
ADD COLUMN     "d4hTeamName" TEXT NOT NULL,
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "sentAt" TIMESTAMP(3),
ADD COLUMN     "teamId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "self_audit_requests" DROP COLUMN "d4hTeamId",
DROP COLUMN "d4hTeamTitle";

-- CreateIndex
CREATE INDEX "self_audit_campaigns_teamId_idx" ON "self_audit_campaigns"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "self_audit_requests_campaignId_d4hMemberId_key" ON "self_audit_requests"("campaignId", "d4hMemberId");

-- AddForeignKey
ALTER TABLE "self_audit_campaigns" ADD CONSTRAINT "self_audit_campaigns_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
