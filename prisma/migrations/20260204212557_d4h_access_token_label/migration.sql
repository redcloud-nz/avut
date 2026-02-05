/*
  Warnings:

  - Added the required column `label` to the `d4h_access_tokens` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "d4h_access_tokens" ADD COLUMN     "label" TEXT NOT NULL;
