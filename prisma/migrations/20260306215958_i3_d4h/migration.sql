/*
  Warnings:

  - You are about to drop the column `description` on the `i3_template_variants` table. All the data in the column will be lost.
  - You are about to drop the column `properties` on the `i3_template_variants` table. All the data in the column will be lost.
  - You are about to drop the column `outputs` on the `i3_templates` table. All the data in the column will be lost.
  - You are about to drop the column `properties` on the `i3_templates` table. All the data in the column will be lost.
  - You are about to drop the column `storageType` on the `i3_templates` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "i3_template_variants" DROP COLUMN "description",
DROP COLUMN "properties";

-- AlterTable
ALTER TABLE "i3_templates" DROP COLUMN "outputs",
DROP COLUMN "properties",
DROP COLUMN "storageType";

-- DropEnum
DROP TYPE "I3StorageType";

-- CreateTable
CREATE TABLE "i3_template_d4h" (
    "templateId" TEXT NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "categoryTitle" TEXT NOT NULL,
    "kindId" INTEGER NOT NULL,
    "kindTitle" TEXT NOT NULL,
    "outputRefFormat" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "i3_template_variant_d4h" (
    "variantId" TEXT NOT NULL,
    "brandId" INTEGER NOT NULL,
    "brandTitle" TEXT NOT NULL,
    "modelId" INTEGER NOT NULL,
    "modelTitle" TEXT NOT NULL,
    "outputRefFormat" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "i3_template_d4h_templateId_key" ON "i3_template_d4h"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "i3_template_variant_d4h_variantId_key" ON "i3_template_variant_d4h"("variantId");

-- AddForeignKey
ALTER TABLE "i3_template_d4h" ADD CONSTRAINT "i3_template_d4h_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "i3_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "i3_template_variant_d4h" ADD CONSTRAINT "i3_template_variant_d4h_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "i3_template_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
