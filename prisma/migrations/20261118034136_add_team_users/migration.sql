-- CreateTable
CREATE TABLE "team_users" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "team_users_organizationId_userId_idx" ON "team_users"("organizationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "team_users_teamId_userId_key" ON "team_users"("teamId", "userId");

-- AddForeignKey
ALTER TABLE "team_users" ADD CONSTRAINT "team_users_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_users" ADD CONSTRAINT "team_users_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_users" ADD CONSTRAINT "team_users_organizationId_userId_fkey" FOREIGN KEY ("organizationId", "userId") REFERENCES "organization_users"("organizationId", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

