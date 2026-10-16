-- "What's new" moves from a date cursor to a per-release version cursor. The date cursor never
-- reached production (it shipped after v0.10), so there's nothing worth converting.
ALTER TABLE "users" DROP COLUMN "lastSeenUpdatesAt",
ADD COLUMN     "lastSeenUpdatesVersion" TEXT;
