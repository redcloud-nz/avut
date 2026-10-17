-- CreateEnum
CREATE TYPE "OrganizationGroupRole" AS ENUM ('Overseer', 'Member');

-- CreateEnum
CREATE TYPE "OrganizationGroupMembershipStatus" AS ENUM ('Invited', 'Active', 'Revoked');

-- CreateTable
CREATE TABLE "organization_groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_group_memberships" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" "OrganizationGroupRole" NOT NULL,
    "status" "OrganizationGroupMembershipStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_group_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organization_groups_slug_key" ON "organization_groups"("slug");

-- CreateIndex
CREATE INDEX "organization_group_memberships_groupId_idx" ON "organization_group_memberships"("groupId");

-- CreateIndex
CREATE INDEX "organization_group_memberships_organizationId_idx" ON "organization_group_memberships"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "organization_group_memberships_groupId_organizationId_key" ON "organization_group_memberships"("groupId", "organizationId");

-- AddForeignKey
ALTER TABLE "organization_group_memberships" ADD CONSTRAINT "organization_group_memberships_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "organization_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_group_memberships" ADD CONSTRAINT "organization_group_memberships_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_credentials" ADD CONSTRAINT "provider_credentials_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "organization_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
