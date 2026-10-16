-- AlterTable
-- "checkedAt" and "recordedAt" replace "createdAt" and "updatedAt". Added nullable, backfilled,
-- then made NOT NULL.
ALTER TABLE "skill_checks" ADD COLUMN     "checkedAt" TIMESTAMP(3),
ADD COLUMN     "recordedAt" TIMESTAMP(3);

-- Approve and reopen re-stamped "updatedAt" on Include/Exclude/Pending rows, so only Draft and
-- Deleted rows still carry the assessor's last write there; the rest fall back to "createdAt".
UPDATE "skill_checks" SET "recordedAt" = CASE WHEN "status" IN ('Draft', 'Deleted') THEN "updatedAt" ELSE "createdAt" END;

-- A session check's competency date is its session's date.
UPDATE "skill_checks" c SET "checkedAt" = COALESCE(
    (SELECT s."startsAt" FROM "skill_check_sessions" s WHERE s."id" = c."sessionId"),
    c."createdAt"
);

ALTER TABLE "skill_checks" ALTER COLUMN "checkedAt" SET NOT NULL,
ALTER COLUMN "recordedAt" SET NOT NULL,
ALTER COLUMN "recordedAt" SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "skill_checks" DROP COLUMN "createdAt",
DROP COLUMN "updatedAt";
