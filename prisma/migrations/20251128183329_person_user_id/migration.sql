-- AlterTable
ALTER TABLE "organization_log_entries" ADD COLUMN     "changes" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "personnel" ADD COLUMN     "userId" TEXT;

-- AddForeignKey
ALTER TABLE "personnel" ADD CONSTRAINT "personnel_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
