/*
  Warnings:

  - A unique constraint covering the columns `[organizationId,skillPackageId]` on the table `skill_package_subscriptions` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "skill_package_subscriptions_organizationId_skillPackageId_key" ON "skill_package_subscriptions"("organizationId", "skillPackageId");
