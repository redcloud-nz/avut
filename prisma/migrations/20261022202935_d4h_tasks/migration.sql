-- CreateTable
CREATE TABLE "d4h_tasks" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "d4hTeamId" INTEGER NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" INTEGER NOT NULL,
    "itemLabel" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'Open',
    "applyMethod" TEXT NOT NULL DEFAULT 'Manual',
    "requestedById" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appliedById" TEXT,
    "appliedAt" TIMESTAMP(3),
    "formInstanceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "d4h_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "d4h_tasks_organizationId_status_idx" ON "d4h_tasks"("organizationId", "status");

-- CreateIndex
CREATE INDEX "d4h_tasks_organizationId_d4hTeamId_resourceId_idx" ON "d4h_tasks"("organizationId", "d4hTeamId", "resourceId");

-- AddForeignKey
ALTER TABLE "d4h_tasks" ADD CONSTRAINT "d4h_tasks_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "d4h_tasks" ADD CONSTRAINT "d4h_tasks_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "d4h_tasks" ADD CONSTRAINT "d4h_tasks_appliedById_fkey" FOREIGN KEY ("appliedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "d4h_tasks" ADD CONSTRAINT "d4h_tasks_formInstanceId_fkey" FOREIGN KEY ("formInstanceId") REFERENCES "form_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;
