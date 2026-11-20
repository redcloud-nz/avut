-- CreateEnum
CREATE TYPE "D4HNagRunTrigger" AS ENUM ('Cron', 'Manual');

-- CreateEnum
CREATE TYPE "D4HNagRunStatus" AS ENUM ('Running', 'Completed', 'Failed');

-- CreateEnum
CREATE TYPE "D4HNagOutcome" AS ENUM ('Pending', 'Sent', 'Failed', 'SkippedNoEmail', 'SkippedOptedOut', 'SkippedAlreadyReminded', 'DryRun');

-- CreateEnum
CREATE TYPE "D4HNagOptOutSource" AS ENUM ('Self', 'Admin');

-- CreateTable
CREATE TABLE "d4h_nag_rules" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "hour" INTEGER NOT NULL,
    "lookAheadHours" INTEGER NOT NULL DEFAULT 24,
    "message" TEXT NOT NULL DEFAULT '',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastScheduledFor" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "d4h_nag_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "d4h_nag_runs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "ruleId" TEXT,
    "teamId" TEXT NOT NULL,
    "teamName" TEXT NOT NULL,
    "trigger" "D4HNagRunTrigger" NOT NULL,
    "dryRun" BOOLEAN NOT NULL,
    "startedById" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "windowStart" TIMESTAMP(3) NOT NULL,
    "windowEnd" TIMESTAMP(3) NOT NULL,
    "exercisesFound" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "status" "D4HNagRunStatus" NOT NULL,
    "error" TEXT,
    "logBatchId" TEXT,

    CONSTRAINT "d4h_nag_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "d4h_nag_recipients" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "d4hTeamId" INTEGER NOT NULL,
    "d4hExerciseId" INTEGER NOT NULL,
    "exerciseTitle" TEXT NOT NULL,
    "exerciseStartsAt" TIMESTAMP(3) NOT NULL,
    "d4hMemberId" INTEGER NOT NULL,
    "memberName" TEXT NOT NULL,
    "email" TEXT,
    "outcome" "D4HNagOutcome" NOT NULL,
    "tokenHash" TEXT,
    "dedupeKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "d4h_nag_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "d4h_nag_opt_outs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "d4hMemberId" INTEGER NOT NULL,
    "memberName" TEXT NOT NULL,
    "source" "D4HNagOptOutSource" NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "d4h_nag_opt_outs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "d4h_nag_rules_organizationId_idx" ON "d4h_nag_rules"("organizationId");

-- CreateIndex
CREATE INDEX "d4h_nag_rules_teamId_idx" ON "d4h_nag_rules"("teamId");

-- CreateIndex
CREATE INDEX "d4h_nag_runs_organizationId_startedAt_idx" ON "d4h_nag_runs"("organizationId", "startedAt");

-- CreateIndex
CREATE INDEX "d4h_nag_runs_ruleId_startedAt_idx" ON "d4h_nag_runs"("ruleId", "startedAt");

-- CreateIndex
CREATE INDEX "d4h_nag_runs_status_startedAt_idx" ON "d4h_nag_runs"("status", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "d4h_nag_recipients_tokenHash_key" ON "d4h_nag_recipients"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "d4h_nag_recipients_dedupeKey_key" ON "d4h_nag_recipients"("dedupeKey");

-- CreateIndex
CREATE INDEX "d4h_nag_recipients_runId_idx" ON "d4h_nag_recipients"("runId");

-- CreateIndex
CREATE INDEX "d4h_nag_opt_outs_organizationId_d4hMemberId_idx" ON "d4h_nag_opt_outs"("organizationId", "d4hMemberId");

-- CreateIndex
CREATE UNIQUE INDEX "d4h_nag_opt_outs_teamId_d4hMemberId_key" ON "d4h_nag_opt_outs"("teamId", "d4hMemberId");

-- AddForeignKey
ALTER TABLE "d4h_nag_rules" ADD CONSTRAINT "d4h_nag_rules_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "d4h_nag_rules" ADD CONSTRAINT "d4h_nag_rules_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "d4h_nag_rules" ADD CONSTRAINT "d4h_nag_rules_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "d4h_nag_runs" ADD CONSTRAINT "d4h_nag_runs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "d4h_nag_runs" ADD CONSTRAINT "d4h_nag_runs_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "d4h_nag_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "d4h_nag_runs" ADD CONSTRAINT "d4h_nag_runs_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "d4h_nag_runs" ADD CONSTRAINT "d4h_nag_runs_startedById_fkey" FOREIGN KEY ("startedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "d4h_nag_recipients" ADD CONSTRAINT "d4h_nag_recipients_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "d4h_nag_recipients" ADD CONSTRAINT "d4h_nag_recipients_runId_fkey" FOREIGN KEY ("runId") REFERENCES "d4h_nag_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "d4h_nag_opt_outs" ADD CONSTRAINT "d4h_nag_opt_outs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "d4h_nag_opt_outs" ADD CONSTRAINT "d4h_nag_opt_outs_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "d4h_nag_opt_outs" ADD CONSTRAINT "d4h_nag_opt_outs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
