-- CreateTable
CREATE TABLE "form_instances" (
    "id" TEXT NOT NULL,
    "formKey" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "formData" JSONB NOT NULL DEFAULT '{}',
    "formStatus" TEXT NOT NULL DEFAULT 'Draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "form_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_instance_items" (
    "id" TEXT NOT NULL,
    "formInstanceId" TEXT NOT NULL,
    "parentItemId" TEXT,
    "collectionKey" TEXT NOT NULL,
    "formData" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "form_instance_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "form_instances_formKey_organizationId_userId_idx" ON "form_instances"("formKey", "organizationId", "userId");

-- CreateIndex
CREATE INDEX "form_instance_items_formInstanceId_idx" ON "form_instance_items"("formInstanceId");

-- AddForeignKey
ALTER TABLE "form_instances" ADD CONSTRAINT "form_instances_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_instances" ADD CONSTRAINT "form_instances_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_instance_items" ADD CONSTRAINT "form_instance_items_formInstanceId_fkey" FOREIGN KEY ("formInstanceId") REFERENCES "form_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_instance_items" ADD CONSTRAINT "form_instance_items_parentItemId_fkey" FOREIGN KEY ("parentItemId") REFERENCES "form_instance_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
