-- CreateTable
CREATE TABLE "i3_bundles" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'Active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "i3_bundles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "i3_bundle_items" (
    "bundleId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "i3_bundle_items_pkey" PRIMARY KEY ("bundleId","templateId")
);

-- CreateIndex
CREATE INDEX "i3_bundles_organizationId_idx" ON "i3_bundles"("organizationId");

-- CreateIndex
CREATE INDEX "i3_bundle_items_templateId_idx" ON "i3_bundle_items"("templateId");

-- AddForeignKey
ALTER TABLE "i3_bundles" ADD CONSTRAINT "i3_bundles_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "i3_bundle_items" ADD CONSTRAINT "i3_bundle_items_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "i3_bundles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "i3_bundle_items" ADD CONSTRAINT "i3_bundle_items_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "i3_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
