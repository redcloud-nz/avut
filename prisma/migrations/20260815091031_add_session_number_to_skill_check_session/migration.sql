-- AlterTable: add sessionNumber, backfilling existing rows with a per-organization sequence
ALTER TABLE "skill_check_sessions" ADD COLUMN "sessionNumber" INTEGER;

WITH numbered AS (
    SELECT "id", ROW_NUMBER() OVER (PARTITION BY "organizationId" ORDER BY "createdAt") AS rn
    FROM "skill_check_sessions"
)
UPDATE "skill_check_sessions" AS s
SET "sessionNumber" = numbered.rn
FROM numbered
WHERE s."id" = numbered."id";

ALTER TABLE "skill_check_sessions" ALTER COLUMN "sessionNumber" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "skill_check_sessions_organizationId_sessionNumber_key" ON "skill_check_sessions"("organizationId", "sessionNumber");
