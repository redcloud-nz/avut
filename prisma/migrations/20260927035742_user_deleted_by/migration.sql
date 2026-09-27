-- CreateEnum
CREATE TYPE "AccountDeletedBy" AS ENUM ('Self', 'Admin');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "deletedBy" "AccountDeletedBy";
