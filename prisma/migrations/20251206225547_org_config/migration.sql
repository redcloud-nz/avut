-- CreateTable
CREATE TABLE "organization_config" (
    "organizationId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL
);

-- CreateTable
CREATE TABLE "team_config" (
    "teamId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "organization_config_organizationId_key_key" ON "organization_config"("organizationId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "team_config_teamId_key_key" ON "team_config"("teamId", "key");

-- AddForeignKey
ALTER TABLE "organization_config" ADD CONSTRAINT "organization_config_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_config" ADD CONSTRAINT "team_config_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
