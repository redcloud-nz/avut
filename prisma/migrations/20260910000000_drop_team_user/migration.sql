-- DropForeignKey
ALTER TABLE "team_users" DROP CONSTRAINT "team_users_teamId_fkey";

-- DropForeignKey
ALTER TABLE "team_users" DROP CONSTRAINT "team_users_userId_fkey";

-- AlterTable
ALTER TABLE "teams" DROP COLUMN "memberCount";

-- DropTable
DROP TABLE "team_users";

