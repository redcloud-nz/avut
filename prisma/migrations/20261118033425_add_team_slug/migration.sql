-- AlterTable
ALTER TABLE "teams" ADD COLUMN     "slug" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "teams_slug_key" ON "teams"("slug");
