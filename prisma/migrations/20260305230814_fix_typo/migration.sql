/*
  Warnings:

  - You are about to drop the column `active` on the `d4h_ppe_templates` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "d4h_ppe_templates" DROP COLUMN "active",
ADD COLUMN     "status" "RecordStatus" NOT NULL DEFAULT 'Active';
