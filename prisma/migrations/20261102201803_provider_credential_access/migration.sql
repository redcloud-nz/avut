-- CreateEnum
CREATE TYPE "ProviderCredentialAccess" AS ENUM ('ReadOnly', 'ReadWrite');

-- AlterTable
ALTER TABLE "provider_credentials" ADD COLUMN     "access" "ProviderCredentialAccess" NOT NULL DEFAULT 'ReadOnly';

-- Personal tokens keep writing to D4H (I3 issue/return); org tokens stay read only.
UPDATE "provider_credentials" SET "access" = 'ReadWrite' WHERE "userId" IS NOT NULL;
