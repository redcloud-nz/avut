/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

/*
 * Runs one D4H attendance reminder rule: finds the exercises starting in the run's window, the
 * members whose attendance is still `REQUESTED`, and emails each of them once (decisions 13–16).
 *
 * A run is split in two so Run now can answer the request before the slow part:
 * `startRun` records the `D4HNagRun` (`Running`) and returns its id; `executeRun` does the D4H
 * fetches and the send loop, and always leaves the run `Completed` or `Failed` rather than
 * throwing. `runRule` is both in sequence, which is the cron's path.
 */

import "server-only";

import { baseUrl } from "@/emails/base-url";
import D4HAttendanceReminderEmail, {
    d4hAttendanceReminderSubject,
} from "@/emails/d4h-attendance-reminder";
import type { PrismaClient } from "@/generated/prisma/client";
import { MIN_LEAD_MS, scheduledWindow } from "@/lib/d4h-nag-schedule";
import { d4hExerciseViewUrl } from "@/lib/d4h-servers";
import { NotFoundError } from "@/lib/errors";
import type { D4HAccessToken_ServerOnly } from "@/lib/schemas/d4h-access-token";
import {
    D4HNagRecipientId,
    D4HNagRuleId,
    D4HNagRunId,
    type D4HNagOutcome,
    type D4HNagRunStatus,
    type D4HNagRunTrigger,
} from "@/lib/schemas/d4h-nag";
import type { D4HActivity } from "@/lib/schemas/d4h/activity";
import type { D4HActivityAttendance } from "@/lib/schemas/d4h/activity-attendance";
import type { UserId } from "@/lib/schemas/user";
import { toD4HCredentialRef } from "@/server/d4h-access-token";
import {
    fetchD4HExercisesStartingBetween,
    fetchD4HMembersByIds,
    fetchD4HRequestedAttendance,
    fetchD4HTeamDetailCached,
    type D4HMemberWithOptionalEmail,
} from "@/server/d4h-api/client";
import { NoReplyEmailAddress, orgReplyTo, sendEmail, type SendEmailResult } from "@/server/email";
import { createLinkToken } from "@/server/link-token";
import { createLogBatch } from "@/server/log-entry";
import { isUniqueViolation } from "@/server/prisma-errors";

import { checkRunnable, defaultRunnabilityDeps, type Runnability } from "./d4h-nag";
import * as OrgSettings from "./organization-settings";
import { unattendedOrgContext, withBatch, type OrgServiceContext } from "./service-context";

/** The least time between two sends, to stay under Resend's per-second limit (decision 16). */
export const SEND_SPACING_MS = 500;

/** The `actorLabel` on a cron run's audit batch and entry, which have no user behind them. */
export const CRON_ACTOR_LABEL = "D4H attendance reminders";

const HOUR_MS = 60 * 60 * 1000;

/** Everything a run reaches outside the database, injectable so tests run offline. */
export interface RunnerDeps {
    /** Whether the rule can run, with its token, D4H team and timezone (decision 6). */
    checkRunnable: (
        ctx: Pick<OrgServiceContext, "prisma" | "organizationId">,
        ruleId: D4HNagRuleId,
    ) => Promise<Runnability>;
    fetchExercises: (
        token: D4HAccessToken_ServerOnly,
        d4hTeamId: number,
        window: { startsAfter: Date; startsBefore: Date },
    ) => Promise<D4HActivity[]>;
    fetchRequestedAttendance: (
        token: D4HAccessToken_ServerOnly,
        d4hTeamId: number,
        exerciseIds: readonly number[],
    ) => Promise<D4HActivityAttendance[]>;
    fetchMembersByIds: (
        token: D4HAccessToken_ServerOnly,
        d4hTeamId: number,
        memberIds: readonly number[],
    ) => Promise<D4HMemberWithOptionalEmail[]>;
    /** The team's D4H subdomain, for the exercise link. */
    fetchTeamDetail: (
        token: D4HAccessToken_ServerOnly,
        d4hTeamId: number,
    ) => Promise<{ subdomain: string }>;
    sendEmail: typeof sendEmail;
    sleep: (ms: number) => Promise<void>;
    createLinkToken: typeof createLinkToken;
}

export const defaultRunnerDeps: RunnerDeps = {
    checkRunnable: (ctx, ruleId) => checkRunnable(ctx, ruleId, defaultRunnabilityDeps),
    fetchExercises: fetchD4HExercisesStartingBetween,
    fetchRequestedAttendance: fetchD4HRequestedAttendance,
    fetchMembersByIds: fetchD4HMembersByIds,
    fetchTeamDetail: (token, d4hTeamId) =>
        fetchD4HTeamDetailCached(toD4HCredentialRef(token), d4hTeamId),
    sendEmail,
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    createLinkToken,
};

/**
 * The context a run takes. A Run now passes the user's `OrgServiceContext`, so its audit entry
 * names them; the cron passes just `prisma` and `organizationId`, and its entry is actor-less
 * under a batch labelled `CRON_ACTOR_LABEL` (decision 25).
 */
export type RunnerContext =
    | OrgServiceContext
    | Pick<OrgServiceContext, "prisma" | "organizationId">;

export interface StartRunOptions {
    trigger: D4HNagRunTrigger;
    dryRun: boolean;
    now: Date;
    /** The scheduled slot a cron run is for. Omitted for a manual run (decision 10). */
    slot?: Date;
    /** The user behind a manual run. */
    startedById?: UserId;
}

/**
 * Record a new `Running` run for the rule, with its team and the exercise window it will search
 * (decision 10): `[max(now, slot) + 1h, slot + lookAheadHours]` for a scheduled run,
 * `[now + 1h, now + lookAheadHours]` for a manual one. An empty window is stored as it is
 * (start not before end), and `executeRun` completes it with zero exercises.
 * @throws NotFoundError if the rule does not exist within the organization.
 */
export async function startRun(
    ctx: Pick<OrgServiceContext, "prisma" | "organizationId">,
    ruleId: D4HNagRuleId,
    { trigger, dryRun, now, slot, startedById }: StartRunOptions,
): Promise<D4HNagRunId> {
    const rule = await ctx.prisma.d4HNagRule.findUnique({
        where: { id: ruleId, organizationId: ctx.organizationId },
        select: { lookAheadHours: true, team: { select: { id: true, name: true } } },
    });
    if (!rule) throw new NotFoundError(`D4HNagRule(id=${ruleId}) not found.`);

    const base = slot ?? now;
    const window = scheduledWindow(base, rule.lookAheadHours, now) ?? {
        start: new Date(Math.max(now.getTime(), base.getTime()) + MIN_LEAD_MS),
        end: new Date(base.getTime() + rule.lookAheadHours * HOUR_MS),
    };

    const id = D4HNagRunId.create();
    await ctx.prisma.d4HNagRun.create({
        data: {
            id,
            organizationId: ctx.organizationId,
            ruleId,
            teamId: rule.team.id,
            teamName: rule.team.name,
            trigger,
            dryRun,
            startedById: startedById ?? null,
            startedAt: now,
            windowStart: window.start,
            windowEnd: window.end,
            status: "Running",
        },
    });
    return id;
}

/** How a run ended, as `executeRun` reports it. */
export interface RunResult {
    runId: D4HNagRunId;
    status: Exclude<D4HNagRunStatus, "Running">;
    /** Whether any email was handed to `sendEmail`. A failed run with none can be retried. */
    sendAttempted: boolean;
    error: string | null;
}

/** One reminder to consider: an exercise and a member whose attendance is still `REQUESTED`. */
interface Candidate {
    exercise: { id: number; title: string; startsAt: Date };
    memberId: number;
    member: D4HMemberWithOptionalEmail | undefined;
}

/**
 * Do a started run: check the rule is runnable, fetch from D4H, decide and send each reminder,
 * then complete the run with its counts and, for a real run, its audit entry. Never throws for a
 * failure inside the run: it records `Failed` with the error instead, and releases any claim
 * still `Pending`. Does nothing to a run that is no longer `Running`.
 * @throws NotFoundError if the run does not exist within the organization.
 */
export async function executeRun(
    ctx: RunnerContext,
    runId: D4HNagRunId,
    deps: RunnerDeps = defaultRunnerDeps,
): Promise<RunResult> {
    const { prisma, organizationId } = ctx;
    const run = await prisma.d4HNagRun.findUnique({ where: { id: runId, organizationId } });
    if (!run) throw new NotFoundError(`D4HNagRun(id=${runId}) not found.`);
    if (run.status !== "Running") {
        return {
            runId,
            status: run.status,
            sendAttempted: false,
            error: run.error,
        };
    }

    const counts = { exercisesFound: 0, sentCount: 0, skippedCount: 0, failedCount: 0 };
    let sendAttempted = false;

    try {
        if (!run.ruleId) throw new Error("The rule was deleted.");
        const ruleId = D4HNagRuleId.schema.parse(run.ruleId);

        // 1. Runnability (decision 6).
        const runnability = await deps.checkRunnable({ prisma, organizationId }, ruleId);
        if (!runnability.runnable) {
            throw new Error(`The rule is paused: ${runnability.reason}.`);
        }
        const { token, d4hTeamId, timeZone } = runnability;

        const rule = await prisma.d4HNagRule.findUniqueOrThrow({
            where: { id: ruleId },
            select: { message: true },
        });

        // 2. D4H: exercises in the window, their requested attendance, those members.
        const exercises =
            run.windowStart < run.windowEnd
                ? await deps.fetchExercises(token, d4hTeamId, {
                      startsAfter: run.windowStart,
                      startsBefore: run.windowEnd,
                  })
                : [];
        counts.exercisesFound = exercises.length;

        const attendance =
            exercises.length > 0
                ? await deps.fetchRequestedAttendance(
                      token,
                      d4hTeamId,
                      exercises.map((exercise) => exercise.id),
                  )
                : [];
        const memberIds = [...new Set(attendance.map((record) => record.member.id))];
        const members =
            memberIds.length > 0 ? await deps.fetchMembersByIds(token, d4hTeamId, memberIds) : [];
        const membersById = new Map(members.map((member) => [member.id, member]));

        const needsSend = !run.dryRun && attendance.length > 0;
        const subdomain = needsSend
            ? (await deps.fetchTeamDetail(token, d4hTeamId)).subdomain
            : null;

        const candidates = buildCandidates(exercises, attendance, membersById);

        // 3. Opt-outs across every AVUT team in this org linked to the D4H team (decision 19).
        const optedOut = await loadOptedOutMemberIds(prisma, organizationId, d4hTeamId, memberIds);

        const [organization, settings] = await Promise.all([
            prisma.organization.findUniqueOrThrow({
                where: { id: organizationId },
                select: { name: true },
            }),
            needsSend ? OrgSettings.read(prisma, organizationId) : null,
        ]);
        const replyTo = settings ? orgReplyTo(settings) : undefined;

        // 4. One outcome per (exercise, member), in the order the plan sets.
        for (const candidate of candidates) {
            const { exercise, memberId, member } = candidate;
            const email = member?.email?.value.trim() || null;
            const dedupeKey = `${organizationId}:${d4hTeamId}:${exercise.id}:${memberId}`;
            const row = {
                organizationId,
                runId,
                d4hTeamId,
                d4hExerciseId: exercise.id,
                exerciseTitle: exercise.title,
                exerciseStartsAt: exercise.startsAt,
                d4hMemberId: memberId,
                memberName: member?.name ?? `D4H member ${memberId}`,
                email,
            };
            const record = (outcome: D4HNagOutcome) =>
                prisma.d4HNagRecipient.create({
                    data: { id: D4HNagRecipientId.create(), ...row, outcome },
                });

            if (optedOut.has(memberId)) {
                await record("SkippedOptedOut");
                counts.skippedCount++;
                continue;
            }
            if (email === null) {
                await record("SkippedNoEmail");
                counts.skippedCount++;
                continue;
            }
            if (run.dryRun) {
                const claimed = await prisma.d4HNagRecipient.findUnique({
                    where: { dedupeKey },
                    select: { id: true },
                });
                if (claimed) {
                    await record("SkippedAlreadyReminded");
                    counts.skippedCount++;
                } else {
                    // Counted with `sentCount`: a dry run's "sent" is "would have sent".
                    await record("DryRun");
                    counts.sentCount++;
                }
                continue;
            }

            // Claim, then send (decision 14).
            const recipientId = D4HNagRecipientId.create();
            try {
                await prisma.d4HNagRecipient.create({
                    data: { id: recipientId, ...row, outcome: "Pending", dedupeKey },
                });
            } catch (error) {
                if (!isUniqueViolation(error)) throw error;
                await record("SkippedAlreadyReminded");
                counts.skippedCount++;
                continue;
            }

            // Spacing goes between sends, not before the first (decision 16).
            if (sendAttempted) await deps.sleep(SEND_SPACING_MS);
            const link = deps.createLinkToken();
            sendAttempted = true;
            const result: SendEmailResult = await deps.sendEmail({
                from: NoReplyEmailAddress,
                to: email,
                ...(replyTo !== undefined && { replyTo }),
                subject: d4hAttendanceReminderSubject(exercise, timeZone),
                react: D4HAttendanceReminderEmail({
                    organization: { name: organization.name },
                    team: { name: run.teamName },
                    exercise,
                    timeZone,
                    message: rule.message,
                    recipientEmail: email,
                    optOutUrl: `${baseUrl}/public/d4h-nag/opt-out/${link.token}`,
                    d4hExerciseUrl:
                        subdomain === null
                            ? null
                            : d4hExerciseViewUrl(token.serverCode, subdomain, exercise.id),
                }),
            });

            if (result.ok) {
                await prisma.d4HNagRecipient.update({
                    where: { id: recipientId },
                    data: { outcome: "Sent", tokenHash: link.hash },
                });
                counts.sentCount++;
            } else {
                await prisma.d4HNagRecipient.update({
                    where: { id: recipientId },
                    data: { outcome: "Failed", dedupeKey: null },
                });
                counts.failedCount++;
            }
        }

        // 5. Complete, with the audit entry for a real run (decisions 24, 25).
        const completion = {
            status: "Completed" as const,
            completedAt: new Date(),
            ...counts,
        };
        if (run.dryRun) {
            await prisma.d4HNagRun.update({ where: { id: runId }, data: completion });
        } else {
            const { batchId, logCtx } = await openAuditBatch(ctx);
            await prisma.$transaction([
                prisma.d4HNagRun.update({
                    where: { id: runId },
                    data: { ...completion, logBatchId: batchId },
                }),
                logCtx.logEvent({
                    action: "Run",
                    objectType: "D4HNagRule",
                    objectId: ruleId,
                    description: describeRun(run.teamName, counts),
                    refs: [{ objectType: "Team", objectId: run.teamId, role: "context" }],
                }),
            ]);
        }
        return { runId, status: "Completed", sendAttempted, error: null };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        try {
            // A claim left `Pending` by the failure is released, so a later run can retry it.
            const released = await prisma.d4HNagRecipient.updateMany({
                where: { runId, outcome: "Pending" },
                data: { outcome: "Failed", dedupeKey: null },
            });
            await prisma.d4HNagRun.update({
                where: { id: runId },
                data: {
                    status: "Failed",
                    completedAt: new Date(),
                    error: message,
                    ...counts,
                    failedCount: counts.failedCount + released.count,
                },
            });
        } catch (recordError) {
            // Recording the failure failed too; the stuck-run cleanup (decision 12) catches it.
            console.error(`Failed to record the failure of D4HNagRun(id=${runId}):`, recordError);
        }
        return { runId, status: "Failed", sendAttempted, error: message };
    }
}

/**
 * Start a run and execute it in one go: the cron's path. A scheduled run that fails before any
 * send hands its slot back (decision 8), so the next tick retries it: `lastScheduledFor` goes back
 * to `previousLastScheduledFor`, but only while it still holds the slot this run claimed, so a
 * schedule edit made during the run isn't undone.
 */
export async function runRule(
    ctx: RunnerContext,
    ruleId: D4HNagRuleId,
    options: StartRunOptions & { previousLastScheduledFor?: Date | null },
    deps: RunnerDeps = defaultRunnerDeps,
): Promise<RunResult> {
    const { previousLastScheduledFor, ...startOptions } = options;
    const runId = await startRun(ctx, ruleId, startOptions);
    const result = await executeRun(ctx, runId, deps);

    if (result.status === "Failed" && !result.sendAttempted && options.slot) {
        await ctx.prisma.d4HNagRule.updateMany({
            where: {
                id: ruleId,
                organizationId: ctx.organizationId,
                lastScheduledFor: options.slot,
            },
            data: { lastScheduledFor: previousLastScheduledFor ?? null },
        });
    }
    return result;
}

/** Every (exercise, member) pair with `REQUESTED` attendance, exercises in start order. */
function buildCandidates(
    exercises: D4HActivity[],
    attendance: D4HActivityAttendance[],
    membersById: Map<number, D4HMemberWithOptionalEmail>,
): Candidate[] {
    const sorted = exercises
        .map((exercise) => ({
            id: exercise.id,
            title: exercise.referenceDescription ?? exercise.reference ?? "Untitled exercise",
            startsAt: new Date(exercise.startsAt),
        }))
        .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

    const candidates: Candidate[] = [];
    for (const exercise of sorted) {
        const memberIds = new Set(
            attendance
                .filter((record) => record.activity.id === exercise.id)
                .map((record) => record.member.id),
        );
        for (const memberId of memberIds) {
            candidates.push({ exercise, memberId, member: membersById.get(memberId) });
        }
    }
    return candidates;
}

/**
 * The D4H member ids opted out on any AVUT team in the org currently linked to `d4hTeamId`
 * (decision 19).
 */
async function loadOptedOutMemberIds(
    prisma: PrismaClient,
    organizationId: OrgServiceContext["organizationId"],
    d4hTeamId: number,
    memberIds: number[],
): Promise<Set<number>> {
    if (memberIds.length === 0) return new Set();

    const links = await prisma.team_D4H.findMany({
        where: { d4hTeamId },
        select: { teamId: true },
    });
    const teams = await prisma.team.findMany({
        where: { id: { in: links.map((link) => link.teamId) }, organizationId },
        select: { id: true },
    });
    const optOuts = await prisma.d4HNagOptOut.findMany({
        where: {
            organizationId,
            teamId: { in: teams.map((team) => team.id) },
            d4hMemberId: { in: memberIds },
        },
        select: { d4hMemberId: true },
    });
    return new Set(optOuts.map((optOut) => optOut.d4hMemberId));
}

/**
 * Open the run's single-entry `LogBatch` (decision 25) and the context whose `logEvent` joins
 * it: the user's for a Run now, an actor-less one labelled `CRON_ACTOR_LABEL` for the cron.
 */
async function openAuditBatch(ctx: RunnerContext) {
    if ("logEvent" in ctx) {
        const batch = await createLogBatch(
            { operationKey: "d4h-nag-run", userId: ctx.userId },
            ctx.prisma,
        );
        return { batchId: batch.id, logCtx: withBatch(ctx, batch.id) };
    }
    const batch = await createLogBatch(
        { operationKey: "d4h-nag-run", actorLabel: CRON_ACTOR_LABEL },
        ctx.prisma,
    );
    return {
        batchId: batch.id,
        logCtx: unattendedOrgContext(ctx.prisma, ctx.organizationId, {
            id: batch.id,
            actorLabel: CRON_ACTOR_LABEL,
        }),
    };
}

/** The audit description, e.g. "Alpha: 2 exercises, 5 sent, 3 skipped, 1 failed". */
function describeRun(
    teamName: string,
    counts: {
        exercisesFound: number;
        sentCount: number;
        skippedCount: number;
        failedCount: number;
    },
): string {
    const exercises = `${counts.exercisesFound} exercise${counts.exercisesFound === 1 ? "" : "s"}`;
    return `${teamName}: ${exercises}, ${counts.sentCount} sent, ${counts.skippedCount} skipped, ${counts.failedCount} failed`;
}
