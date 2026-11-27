/*
  Warnings:

  - You are about to drop the `kit_check_requests` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `kit_checks` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "SelfAuditDeliveryStatus" AS ENUM ('Pending', 'Sent', 'Failed', 'NoEmail');

-- DropForeignKey
ALTER TABLE "kit_check_requests" DROP CONSTRAINT "kit_check_requests_formInstanceId_fkey";

-- DropForeignKey
ALTER TABLE "kit_check_requests" DROP CONSTRAINT "kit_check_requests_kitCheckId_fkey";

-- DropForeignKey
ALTER TABLE "kit_check_requests" DROP CONSTRAINT "kit_check_requests_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "kit_checks" DROP CONSTRAINT "kit_checks_bundleId_fkey";

-- DropForeignKey
ALTER TABLE "kit_checks" DROP CONSTRAINT "kit_checks_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "kit_checks" DROP CONSTRAINT "kit_checks_sentById_fkey";

-- DropTable
DROP TABLE "kit_check_requests";

-- DropTable
DROP TABLE "kit_checks";

-- DropEnum
DROP TYPE "KitCheckDeliveryStatus";

-- CreateTable
CREATE TABLE "self_audit_campaigns" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "bundleId" TEXT,
    "bundleName" TEXT NOT NULL,
    "d4hTeams" JSONB NOT NULL,
    "templates" JSONB NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'Active',
    "sentById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "self_audit_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "self_audit_requests" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "d4hTeamId" INTEGER NOT NULL,
    "d4hTeamTitle" TEXT NOT NULL,
    "d4hMemberId" INTEGER NOT NULL,
    "memberName" TEXT NOT NULL,
    "email" TEXT,
    "heldItems" JSONB NOT NULL,
    "tokenHash" TEXT,
    "expiresAt" TIMESTAMP(3),
    "deliveryStatus" "SelfAuditDeliveryStatus" NOT NULL,
    "sentAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "submittedData" JSONB,
    "formInstanceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "self_audit_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "self_audit_campaigns_organizationId_idx" ON "self_audit_campaigns"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "self_audit_requests_tokenHash_key" ON "self_audit_requests"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "self_audit_requests_formInstanceId_key" ON "self_audit_requests"("formInstanceId");

-- CreateIndex
CREATE UNIQUE INDEX "self_audit_requests_campaignId_d4hTeamId_d4hMemberId_key" ON "self_audit_requests"("campaignId", "d4hTeamId", "d4hMemberId");

-- AddForeignKey
ALTER TABLE "self_audit_campaigns" ADD CONSTRAINT "self_audit_campaigns_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "self_audit_campaigns" ADD CONSTRAINT "self_audit_campaigns_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "i3_bundles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "self_audit_campaigns" ADD CONSTRAINT "self_audit_campaigns_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "self_audit_requests" ADD CONSTRAINT "self_audit_requests_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "self_audit_requests" ADD CONSTRAINT "self_audit_requests_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "self_audit_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "self_audit_requests" ADD CONSTRAINT "self_audit_requests_formInstanceId_fkey" FOREIGN KEY ("formInstanceId") REFERENCES "form_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;
