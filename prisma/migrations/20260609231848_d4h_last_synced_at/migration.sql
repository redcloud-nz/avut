/*
  Warnings:

  - You are about to drop the column `d4hLastSyncAt` on the `team_d4h` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "team_d4h" DROP COLUMN "d4hLastSyncAt",
ADD COLUMN     "d4hLastSyncedAt" TIMESTAMP(3);
