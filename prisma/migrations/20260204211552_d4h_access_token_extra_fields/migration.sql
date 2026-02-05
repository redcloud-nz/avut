/*
  Warnings:

  - Added the required column `serverCode` to the `d4h_access_tokens` table without a default value. This is not possible if the table is not empty.
  - Added the required column `status` to the `d4h_access_tokens` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "d4h_access_tokens" ADD COLUMN     "serverCode" TEXT NOT NULL,
ADD COLUMN     "status" TEXT NOT NULL;
