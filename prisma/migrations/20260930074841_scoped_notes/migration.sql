/*
  Warnings:

  - You are about to drop the `notes` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "notes" DROP CONSTRAINT "notes_authorId_fkey";

-- DropForeignKey
ALTER TABLE "notes" DROP CONSTRAINT "notes_organizationId_fkey";

-- DropTable
DROP TABLE "notes";

-- CreateTable
CREATE TABLE "organization_notes" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "authorId" TEXT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_notes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "organization_notes_organizationId_idx" ON "organization_notes"("organizationId");

-- CreateIndex
CREATE INDEX "user_notes_userId_idx" ON "user_notes"("userId");

-- AddForeignKey
ALTER TABLE "organization_notes" ADD CONSTRAINT "organization_notes_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_notes" ADD CONSTRAINT "organization_notes_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_notes" ADD CONSTRAINT "user_notes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
