/*
  Warnings:

  - You are about to drop the column `userId` on the `personnel` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[organizationUserId]` on the table `personnel` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "personnel" DROP CONSTRAINT "personnel_userId_fkey";

-- DropIndex
DROP INDEX "personnel_organizationId_userId_key";

-- AlterTable
ALTER TABLE "organization_log_entries" ADD COLUMN     "metadata" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "organization_users" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "personnel" DROP COLUMN "userId",
ADD COLUMN     "organizationUserId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "personnel_organizationUserId_key" ON "personnel"("organizationUserId");

-- AddForeignKey
ALTER TABLE "personnel" ADD CONSTRAINT "personnel_organizationUserId_fkey" FOREIGN KEY ("organizationUserId") REFERENCES "organization_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
