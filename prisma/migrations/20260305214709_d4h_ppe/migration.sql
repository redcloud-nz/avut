-- CreateTable
CREATE TABLE "d4h_ppe_templates" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "d4hCategoryId" INTEGER NOT NULL,
    "d4hKindId" INTEGER NOT NULL,
    "d4hModelsId" INTEGER[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "d4h_ppe_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "d4h_ppe_templates_organizationId_idx" ON "d4h_ppe_templates"("organizationId");

-- AddForeignKey
ALTER TABLE "d4h_ppe_templates" ADD CONSTRAINT "d4h_ppe_templates_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
