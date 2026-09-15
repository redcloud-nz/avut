-- DropIndex
DROP INDEX "organization_invitations_personId_key";

-- CreateIndex
CREATE INDEX "organization_invitations_personId_idx" ON "organization_invitations"("personId");
