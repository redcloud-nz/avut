/*
  Warnings:

  - You are about to drop the `d4h_ppe_templates` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "I3StorageType" AS ENUM ('AVUT', 'D4H');

-- DropForeignKey
ALTER TABLE "d4h_ppe_templates" DROP CONSTRAINT "d4h_ppe_templates_organizationId_fkey";

-- DropTable
DROP TABLE "d4h_ppe_templates";

-- CreateTable
CREATE TABLE "i3_issued_items" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "properties" JSONB NOT NULL DEFAULT '{}',
    "status" "RecordStatus" NOT NULL DEFAULT 'Active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "i3_issued_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "i3_templates" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "storageType" "I3StorageType" NOT NULL,
    "properties" JSONB NOT NULL DEFAULT '{}',
    "outputs" JSONB NOT NULL DEFAULT '{}',
    "status" "RecordStatus" NOT NULL DEFAULT 'Active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "i3_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "i3_template_variants" (
    "id" TEXT NOT NULL,
    "i3TemplateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "properties" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "i3_template_variants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "i3_issued_items_organizationId_idx" ON "i3_issued_items"("organizationId");

-- CreateIndex
CREATE INDEX "i3_issued_items_personId_idx" ON "i3_issued_items"("personId");

-- CreateIndex
CREATE INDEX "i3_templates_organizationId_idx" ON "i3_templates"("organizationId");

-- CreateIndex
CREATE INDEX "i3_template_variants_i3TemplateId_idx" ON "i3_template_variants"("i3TemplateId");

-- AddForeignKey
ALTER TABLE "i3_issued_items" ADD CONSTRAINT "i3_issued_items_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "i3_issued_items" ADD CONSTRAINT "i3_issued_items_personId_fkey" FOREIGN KEY ("personId") REFERENCES "personnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "i3_templates" ADD CONSTRAINT "i3_templates_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "i3_template_variants" ADD CONSTRAINT "i3_template_variants_i3TemplateId_fkey" FOREIGN KEY ("i3TemplateId") REFERENCES "i3_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
