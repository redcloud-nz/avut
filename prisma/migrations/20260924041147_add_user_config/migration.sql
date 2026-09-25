-- CreateTable
CREATE TABLE "user_config" (
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "user_config_userId_key_key" ON "user_config"("userId", "key");

-- AddForeignKey
ALTER TABLE "user_config" ADD CONSTRAINT "user_config_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
