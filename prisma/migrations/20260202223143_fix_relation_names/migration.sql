/*
  Warnings:

  - You are about to drop the `_session_assessees` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_session_assessors` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_session_skills` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `invitations` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `organization_members` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `skill_group_subscriptions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `skill_subscriptions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `team_members` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[organizationId,email]` on the table `personnel` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[organizationId,userId]` on the table `personnel` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "_session_assessees" DROP CONSTRAINT "_session_assessees_A_fkey";

-- DropForeignKey
ALTER TABLE "_session_assessees" DROP CONSTRAINT "_session_assessees_B_fkey";

-- DropForeignKey
ALTER TABLE "_session_assessors" DROP CONSTRAINT "_session_assessors_A_fkey";

-- DropForeignKey
ALTER TABLE "_session_assessors" DROP CONSTRAINT "_session_assessors_B_fkey";

-- DropForeignKey
ALTER TABLE "_session_skills" DROP CONSTRAINT "_session_skills_A_fkey";

-- DropForeignKey
ALTER TABLE "_session_skills" DROP CONSTRAINT "_session_skills_B_fkey";

-- DropForeignKey
ALTER TABLE "invitations" DROP CONSTRAINT "invitations_inviterId_fkey";

-- DropForeignKey
ALTER TABLE "invitations" DROP CONSTRAINT "invitations_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "organization_members" DROP CONSTRAINT "organization_members_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "organization_members" DROP CONSTRAINT "organization_members_userId_fkey";

-- DropForeignKey
ALTER TABLE "skill_group_subscriptions" DROP CONSTRAINT "skill_group_subscriptions_skillGroupId_fkey";

-- DropForeignKey
ALTER TABLE "skill_group_subscriptions" DROP CONSTRAINT "skill_group_subscriptions_subscriptionId_fkey";

-- DropForeignKey
ALTER TABLE "skill_subscriptions" DROP CONSTRAINT "skill_subscriptions_skillId_fkey";

-- DropForeignKey
ALTER TABLE "skill_subscriptions" DROP CONSTRAINT "skill_subscriptions_subscriptionId_fkey";

-- DropForeignKey
ALTER TABLE "team_members" DROP CONSTRAINT "team_members_teamId_fkey";

-- DropForeignKey
ALTER TABLE "team_members" DROP CONSTRAINT "team_members_userId_fkey";

-- AlterTable
ALTER TABLE "teams" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;

-- DropTable
DROP TABLE "_session_assessees";

-- DropTable
DROP TABLE "_session_assessors";

-- DropTable
DROP TABLE "_session_skills";

-- DropTable
DROP TABLE "invitations";

-- DropTable
DROP TABLE "organization_members";

-- DropTable
DROP TABLE "skill_group_subscriptions";

-- DropTable
DROP TABLE "skill_subscriptions";

-- DropTable
DROP TABLE "team_members";

-- CreateTable
CREATE TABLE "team_users" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_users" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_invitations" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT,
    "teamId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inviterId" TEXT NOT NULL,

    CONSTRAINT "organization_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_memberships" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "properties" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_group_overrides" (
    "subscriptionId" TEXT NOT NULL,
    "skillGroupId" TEXT NOT NULL,
    "description" TEXT,
    "include" BOOLEAN NOT NULL
);

-- CreateTable
CREATE TABLE "skill_overrides" (
    "subscriptionId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "description" TEXT,
    "frequency" INTEGER,
    "include" BOOLEAN NOT NULL
);

-- CreateTable
CREATE TABLE "_skill_check_session_assessees" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_skill_check_session_assessees_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_skill_check_session_assessors" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_skill_check_session_assessors_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_skill_check_session_skills" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_skill_check_session_skills_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "team_users_teamId_idx" ON "team_users"("teamId");

-- CreateIndex
CREATE INDEX "team_users_userId_idx" ON "team_users"("userId");

-- CreateIndex
CREATE INDEX "organization_users_organizationId_idx" ON "organization_users"("organizationId");

-- CreateIndex
CREATE INDEX "organization_users_userId_idx" ON "organization_users"("userId");

-- CreateIndex
CREATE INDEX "organization_invitations_organizationId_idx" ON "organization_invitations"("organizationId");

-- CreateIndex
CREATE INDEX "organization_invitations_email_idx" ON "organization_invitations"("email");

-- CreateIndex
CREATE INDEX "team_memberships_teamId_idx" ON "team_memberships"("teamId");

-- CreateIndex
CREATE INDEX "team_memberships_personId_idx" ON "team_memberships"("personId");

-- CreateIndex
CREATE UNIQUE INDEX "team_memberships_teamId_personId_key" ON "team_memberships"("teamId", "personId");

-- CreateIndex
CREATE INDEX "skill_group_overrides_subscriptionId_idx" ON "skill_group_overrides"("subscriptionId");

-- CreateIndex
CREATE INDEX "skill_group_overrides_skillGroupId_idx" ON "skill_group_overrides"("skillGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "skill_group_overrides_subscriptionId_skillGroupId_key" ON "skill_group_overrides"("subscriptionId", "skillGroupId");

-- CreateIndex
CREATE INDEX "skill_overrides_subscriptionId_idx" ON "skill_overrides"("subscriptionId");

-- CreateIndex
CREATE INDEX "skill_overrides_skillId_idx" ON "skill_overrides"("skillId");

-- CreateIndex
CREATE UNIQUE INDEX "skill_overrides_subscriptionId_skillId_key" ON "skill_overrides"("subscriptionId", "skillId");

-- CreateIndex
CREATE INDEX "_skill_check_session_assessees_B_index" ON "_skill_check_session_assessees"("B");

-- CreateIndex
CREATE INDEX "_skill_check_session_assessors_B_index" ON "_skill_check_session_assessors"("B");

-- CreateIndex
CREATE INDEX "_skill_check_session_skills_B_index" ON "_skill_check_session_skills"("B");

-- CreateIndex
CREATE UNIQUE INDEX "personnel_organizationId_email_key" ON "personnel"("organizationId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "personnel_organizationId_userId_key" ON "personnel"("organizationId", "userId");

-- AddForeignKey
ALTER TABLE "team_users" ADD CONSTRAINT "team_users_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_users" ADD CONSTRAINT "team_users_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_users" ADD CONSTRAINT "organization_users_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_users" ADD CONSTRAINT "organization_users_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_memberships" ADD CONSTRAINT "team_memberships_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_memberships" ADD CONSTRAINT "team_memberships_personId_fkey" FOREIGN KEY ("personId") REFERENCES "personnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_group_overrides" ADD CONSTRAINT "skill_group_overrides_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "skill_package_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_group_overrides" ADD CONSTRAINT "skill_group_overrides_skillGroupId_fkey" FOREIGN KEY ("skillGroupId") REFERENCES "skill_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_overrides" ADD CONSTRAINT "skill_overrides_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "skill_package_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_overrides" ADD CONSTRAINT "skill_overrides_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_skill_check_session_assessees" ADD CONSTRAINT "_skill_check_session_assessees_A_fkey" FOREIGN KEY ("A") REFERENCES "personnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_skill_check_session_assessees" ADD CONSTRAINT "_skill_check_session_assessees_B_fkey" FOREIGN KEY ("B") REFERENCES "skill_check_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_skill_check_session_assessors" ADD CONSTRAINT "_skill_check_session_assessors_A_fkey" FOREIGN KEY ("A") REFERENCES "personnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_skill_check_session_assessors" ADD CONSTRAINT "_skill_check_session_assessors_B_fkey" FOREIGN KEY ("B") REFERENCES "skill_check_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_skill_check_session_skills" ADD CONSTRAINT "_skill_check_session_skills_A_fkey" FOREIGN KEY ("A") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_skill_check_session_skills" ADD CONSTRAINT "_skill_check_session_skills_B_fkey" FOREIGN KEY ("B") REFERENCES "skill_check_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
