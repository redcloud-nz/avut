/*
  Warnings:

  - You are about to drop the column `organizationUserId` on the `personnel` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[personId]` on the table `organization_invitations` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[personId]` on the table `organization_users` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "personnel" DROP CONSTRAINT "personnel_organizationUserId_fkey";

-- DropIndex
DROP INDEX "personnel_organizationUserId_key";

-- AlterTable
ALTER TABLE "organization_invitations" ADD COLUMN     "personId" TEXT;

-- AlterTable
ALTER TABLE "organization_users" ADD COLUMN     "personId" TEXT;

-- AlterTable
ALTER TABLE "personnel" DROP COLUMN "organizationUserId";

-- CreateIndex
CREATE UNIQUE INDEX "organization_invitations_personId_key" ON "organization_invitations"("personId");

-- CreateIndex
CREATE UNIQUE INDEX "organization_users_personId_key" ON "organization_users"("personId");

-- AddForeignKey
ALTER TABLE "organization_users" ADD CONSTRAINT "organization_users_personId_fkey" FOREIGN KEY ("personId") REFERENCES "personnel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_personId_fkey" FOREIGN KEY ("personId") REFERENCES "personnel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
