/*
  Warnings:

  - You are about to drop the column `i3TemplateId` on the `i3_template_variants` table. All the data in the column will be lost.
  - Added the required column `requireSN` to the `i3_template_d4h` table without a default value. This is not possible if the table is not empty.
  - Added the required column `templateId` to the `i3_template_variants` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "i3_template_variants" DROP CONSTRAINT "i3_template_variants_i3TemplateId_fkey";

-- DropIndex
DROP INDEX "i3_template_variants_i3TemplateId_idx";

-- AlterTable
ALTER TABLE "i3_template_d4h" ADD COLUMN     "requireSN" BOOLEAN NOT NULL;

-- AlterTable
ALTER TABLE "i3_template_variants" DROP COLUMN "i3TemplateId",
ADD COLUMN     "templateId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "i3_template_variants_templateId_idx" ON "i3_template_variants"("templateId");

-- AddForeignKey
ALTER TABLE "i3_template_variants" ADD CONSTRAINT "i3_template_variants_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "i3_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
