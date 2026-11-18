-- CreateEnum
CREATE TYPE "I3BrandModelRule" AS ENUM ('Required', 'Optional', 'None');

-- AlterTable
ALTER TABLE "i3_template_d4h" ADD COLUMN     "brandModelRule" "I3BrandModelRule" NOT NULL DEFAULT 'Optional';
