-- CreateEnum
CREATE TYPE "KitCheckDeliveryStatus" AS ENUM ('Pending', 'Sent', 'Failed', 'NoEmail');

-- CreateTable
CREATE TABLE "kit_checks" (
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

    CONSTRAINT "kit_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kit_check_requests" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "kitCheckId" TEXT NOT NULL,
    "d4hTeamId" INTEGER NOT NULL,
    "d4hTeamTitle" TEXT NOT NULL,
    "d4hMemberId" INTEGER NOT NULL,
    "memberName" TEXT NOT NULL,
    "email" TEXT,
    "heldItems" JSONB NOT NULL,
    "tokenHash" TEXT,
    "expiresAt" TIMESTAMP(3),
    "deliveryStatus" "KitCheckDeliveryStatus" NOT NULL,
    "sentAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "submittedData" JSONB,
    "formInstanceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kit_check_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "kit_checks_organizationId_idx" ON "kit_checks"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "kit_check_requests_tokenHash_key" ON "kit_check_requests"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "kit_check_requests_formInstanceId_key" ON "kit_check_requests"("formInstanceId");

-- CreateIndex
CREATE UNIQUE INDEX "kit_check_requests_kitCheckId_d4hTeamId_d4hMemberId_key" ON "kit_check_requests"("kitCheckId", "d4hTeamId", "d4hMemberId");

-- AddForeignKey
ALTER TABLE "kit_checks" ADD CONSTRAINT "kit_checks_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kit_checks" ADD CONSTRAINT "kit_checks_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "i3_bundles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kit_checks" ADD CONSTRAINT "kit_checks_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kit_check_requests" ADD CONSTRAINT "kit_check_requests_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kit_check_requests" ADD CONSTRAINT "kit_check_requests_kitCheckId_fkey" FOREIGN KEY ("kitCheckId") REFERENCES "kit_checks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kit_check_requests" ADD CONSTRAINT "kit_check_requests_formInstanceId_fkey" FOREIGN KEY ("formInstanceId") REFERENCES "form_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;
