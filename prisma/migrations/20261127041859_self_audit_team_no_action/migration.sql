-- DropForeignKey
ALTER TABLE "self_audit_campaigns" DROP CONSTRAINT "self_audit_campaigns_teamId_fkey";

-- AddForeignKey
ALTER TABLE "self_audit_campaigns" ADD CONSTRAINT "self_audit_campaigns_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
