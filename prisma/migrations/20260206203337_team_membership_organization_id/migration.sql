/*
  Warnings:

  - Added the required column `organizationId` to the `team_memberships` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "team_memberships" ADD COLUMN     "organizationId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "team_memberships" ADD CONSTRAINT "team_memberships_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
