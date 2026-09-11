-- better-auth 1.7 organization plugin: new team schema fields.
-- `team.memberCount` (required, default 0) and `teamMember.membershipKey`
-- (nullable, unique) are written by the plugin with `input: false`. Without
-- them `auth.api.createTeam` and the team-member APIs fail against Postgres.

-- AlterTable
ALTER TABLE "teams" ADD COLUMN     "memberCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "team_users" ADD COLUMN     "membershipKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "team_users_membershipKey_key" ON "team_users"("membershipKey");
