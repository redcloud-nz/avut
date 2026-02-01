-- AlterTable
ALTER TABLE "teams" ADD COLUMN     "properties" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
