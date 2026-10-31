/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { after } from "next/server";
import * as z from "zod";

import { PreconditionError } from "@/lib/errors";
import { enabledInSettings, isModuleUsable } from "@/lib/module-flags";
import {
    D4HNagOptOutData,
    D4HNagOptOutId,
    D4HNagRuleData,
    D4HNagRuleId,
    D4HNagRunId,
} from "@/lib/schemas/d4h-nag";
import { TeamId } from "@/lib/schemas/team";
import { resolveModuleFlags } from "@/server/module-flags";
import * as D4HNag from "@/server/services/d4h-nag";
import * as D4HNagRunner from "@/server/services/d4h-nag-runner";
import * as OrgSettings from "@/server/services/organization-settings";

import { createTrpcRouter, organizationProcedure, publicProcedure } from "../init";

/** An email's opt-out link token. Anything that isn't one simply resolves to `not-found`. */
const linkTokenSchema = z.string().min(1).max(200);

/**
 * D4H attendance reminders (`d4h-nag`): rules, runs and opt-outs for admins, plus the public
 * opt-out page reached from a reminder email's link token.
 */
export const d4hNagRouter = createTrpcRouter({
    /**
     * Opt a D4H member out of reminders for a team, on an admin's behalf.
     * @throws TRPCError(NOT_FOUND) if the team is not in the organization.
     * @throws TRPCError(CONFLICT) if the member has already opted out for that team.
     */
    addOptOut: organizationProcedure({ d4hNag: ["update"] })
        .input(D4HNagOptOutData.addSchema)
        .mutation(async ({ ctx, input: { teamId, d4hMemberId, memberName } }) => {
            const created = await D4HNag.addOptOut(ctx, { teamId, d4hMemberId, memberName });

            return { created };
        }),

    /**
     * @throws TRPCError(NOT_FOUND) if the team is not in the organization.
     */
    createRule: organizationProcedure({ d4hNag: ["update"] })
        .input(D4HNagRuleData.createSchema)
        .output(z.object({ created: D4HNagRuleData.schema }))
        .mutation(async ({ ctx, input: { organizationId: _, ...data } }) => {
            const created = await D4HNag.createRule(ctx, data);

            return { created };
        }),

    /**
     * Permanently delete a rule. Its runs are kept, as runs of a deleted rule.
     * @throws TRPCError(NOT_FOUND) if the rule is not in the organization.
     */
    deleteRule: organizationProcedure({ d4hNag: ["update"] })
        .input(z.object({ ruleId: D4HNagRuleId.schema }))
        .output(z.object({ deleted: D4HNagRuleData.schema }))
        .mutation(async ({ ctx, input: { ruleId } }) => {
            const deleted = await D4HNag.deleteRule(ctx, ruleId);

            return { deleted };
        }),

    /**
     * The public opt-out page's view of a reminder email's link token. Public: the token alone
     * grants access, and a GET never changes state (decision 21).
     */
    getOptOutByToken: publicProcedure
        .input(z.object({ token: linkTokenSchema }))
        .query(async ({ ctx, input: { token } }) => {
            return await D4HNag.getOptOutByToken(ctx, token);
        }),

    /**
     * @throws TRPCError(NOT_FOUND) if the rule is not in the organization.
     */
    getRule: organizationProcedure({ d4hNag: ["view"] })
        .input(z.object({ ruleId: D4HNagRuleId.schema }))
        .output(D4HNagRuleData.schema)
        .query(async ({ ctx, input: { ruleId } }) => {
            return await D4HNag.requireRuleById(ctx, ruleId);
        }),

    /**
     * A run with its recipients.
     * @throws TRPCError(NOT_FOUND) if the run is not in the organization.
     */
    getRun: organizationProcedure({ d4hNag: ["view"] })
        .input(z.object({ runId: D4HNagRunId.schema }))
        .query(async ({ ctx, input: { runId } }) => {
            return await D4HNag.requireRunById(ctx, runId);
        }),

    /** The active, D4H-linked teams a rule or an opt-out can be made for. */
    listEligibleTeams: organizationProcedure({ d4hNag: ["view"] }).query(async ({ ctx }) => {
        return await D4HNag.listEligibleTeams(ctx);
    }),

    listOptOuts: organizationProcedure({ d4hNag: ["view"] }).query(async ({ ctx }) => {
        return await D4HNag.listOptOuts(ctx);
    }),

    /** The organization's rules, each with why it's paused (if it is) and its latest run. */
    listRules: organizationProcedure({ d4hNag: ["view"] }).query(async ({ ctx }) => {
        return await D4HNag.listRules(ctx);
    }),

    /** The organization's runs, newest first; only one rule's when `ruleId` is given. */
    listRuns: organizationProcedure({ d4hNag: ["view"] })
        .input(z.object({ ruleId: D4HNagRuleId.schema.optional() }))
        .query(async ({ ctx, input: { ruleId } }) => {
            return await D4HNag.listRuns(ctx, { ruleId });
        }),

    /**
     * A team's current D4H members, through the module's D4H token, for picking whom to opt out.
     * On `update`, not `view`, because it exposes the token's view of the member list.
     * @throws TRPCError(NOT_FOUND) if the team is not in the organization.
     */
    listTeamD4HMembers: organizationProcedure({ d4hNag: ["update"] })
        .input(z.object({ teamId: TeamId.schema }))
        .query(async ({ ctx, input: { teamId } }) => {
            return await D4HNag.listTeamD4HMembers(ctx, teamId);
        }),

    /**
     * Remove an opt-out, so the member gets reminders for that team again.
     * @throws TRPCError(NOT_FOUND) if the opt-out is not in the organization.
     */
    removeOptOut: organizationProcedure({ d4hNag: ["update"] })
        .input(z.object({ optOutId: D4HNagOptOutId.schema }))
        .mutation(async ({ ctx, input: { optOutId } }) => {
            await D4HNag.removeOptOut(ctx, optOutId);
        }),

    /**
     * Run now, or Dry run (decision 18). Records the `Running` run inside the request and returns
     * its id; the D4H fetches and sends finish in `after()`, which runs within this route's
     * `maxDuration`. A run `after()` drops is timed out by the hourly dispatcher (decision 12).
     * @throws TRPCError(NOT_FOUND) if the rule is not in the organization.
     * @throws TRPCError(PRECONDITION_FAILED) if the module isn't usable in the organization (its
     *     Vercel flag, its setting or the D4H module it requires is off), or the rule is paused,
     *     naming the reason.
     */
    runRule: organizationProcedure({ d4hNag: ["run"] })
        .input(z.object({ ruleId: D4HNagRuleId.schema, dryRun: z.boolean() }))
        .output(z.object({ runId: D4HNagRunId.schema }))
        .mutation(async ({ ctx, input: { ruleId, dryRun } }) => {
            // The one procedure that sends email, so the one that checks the module is on.
            // Sequential: flag evaluation follows the request's first read, as in
            // `isOrganizationModuleUsable`.
            const settings = await OrgSettings.read(ctx.prisma, ctx.organizationId);
            const moduleFlags = await resolveModuleFlags();
            if (!isModuleUsable(moduleFlags, "d4h-nag", enabledInSettings(settings))) {
                throw new PreconditionError(
                    "D4H attendance reminders aren't enabled in this organization.",
                );
            }

            const runnability = await D4HNag.checkRunnable(ctx, ruleId);
            if (!runnability.runnable) {
                throw new PreconditionError(`The rule is paused: ${runnability.reason}.`);
            }

            const runId = await D4HNagRunner.startRun(ctx, ruleId, {
                trigger: "Manual",
                dryRun,
                now: new Date(),
                startedById: ctx.userId,
            });

            after(async () => {
                try {
                    await D4HNagRunner.executeRun(ctx, runId);
                } catch (error) {
                    // `executeRun` records failures on the run itself; this is only a vanished run.
                    console.error(`[d4h-nag] Run ${runId} could not be executed`, error);
                }
            });

            return { runId };
        }),

    /**
     * Opt the link token's member out of reminders, or back in (decisions 19, 22). Public: the
     * token alone grants access. Returns the page's new view of the token.
     */
    setOptOutByToken: publicProcedure
        .input(z.object({ token: linkTokenSchema, optedOut: z.boolean() }))
        .mutation(async ({ ctx, input: { token, optedOut } }) => {
            return await D4HNag.setOptOutByToken(ctx, token, optedOut);
        }),

    /**
     * Update a rule's schedule, window, message or enabled state.
     * @throws TRPCError(NOT_FOUND) if the rule is not in the organization.
     */
    updateRule: organizationProcedure({ d4hNag: ["update"] })
        .input(D4HNagRuleData.updateSchema.extend({ ruleId: D4HNagRuleId.schema }))
        .output(z.object({ updated: D4HNagRuleData.schema }))
        .mutation(async ({ ctx, input: { organizationId: _, ruleId, ...data } }) => {
            const updated = await D4HNag.updateRule(ctx, ruleId, data);

            return { updated };
        }),
});
