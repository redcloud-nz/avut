/*
  Warnings:

  - You are about to drop the column `d4hModelsId` on the `d4h_ppe_templates` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "d4h_ppe_templates" DROP COLUMN "d4hModelsId",
ADD COLUMN     "d4hModelIds" INTEGER[];
