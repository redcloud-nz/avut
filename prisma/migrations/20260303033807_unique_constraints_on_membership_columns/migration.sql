/*
  Warnings:

  - A unique constraint covering the columns `[organizationId,userId]` on the table `organization_users` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[teamId,userId]` on the table `team_users` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "organization_users_userId_idx";

-- DropIndex
DROP INDEX "team_users_userId_idx";

-- CreateIndex
CREATE UNIQUE INDEX "organization_users_organizationId_userId_key" ON "organization_users"("organizationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "team_users_teamId_userId_key" ON "team_users"("teamId", "userId");
