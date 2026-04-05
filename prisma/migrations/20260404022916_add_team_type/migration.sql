-- CreateEnum
CREATE TYPE "TeamType" AS ENUM ('General', 'D4HDefined');

-- AlterTable
ALTER TABLE "teams" ADD COLUMN     "type" "TeamType" NOT NULL DEFAULT 'General';
