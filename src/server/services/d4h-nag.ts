/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";
import { describeSchedule, latestSlot } from "@/lib/d4h-nag-schedule";
import { diffObject } from "@/lib/diff";
import { ConflictError, NotFoundError } from "@/lib/errors";
import type { D4HAccessToken_ServerOnly } from "@/lib/schemas/d4h-access-token";
import {
    D4HNagOptOutId,
    D4HNagRecipientId,
    D4HNagRuleData,
    D4HNagRuleId,
    D4HNagRunId,
    type AddD4HNagOptOutData,
    type CreateD4HNagRuleData,
    type D4HNagEligibleTeam,
    type D4HNagOptOutByToken,
    type D4HNagOptOutListItem,
    type D4HNagOptOutRecord,
    type D4HNagPausedReason,
    type D4HNagRecipientItem,
    type D4HNagRecipientRecord,
    type D4HNagRuleListItem,
    type D4HNagRuleRecord,
    type D4HNagRunDetail,
    type D4HNagRunListItem,
    type D4HNagRunRecord,
    type D4HNagTeamMembers,
    type UpdateD4HNagRuleData,
} from "@/lib/schemas/d4h-nag";
import type { D4HAccessTokenMetadata } from "@/lib/schemas/d4h-provider-metadata";
import { OrganizationId } from "@/lib/schemas/organization";
import { TeamId } from "@/lib/schemas/team";
import type { RecordStatus } from "@/lib/validation";
import { getD4HNagAccessToken, toD4HCredentialRef } from "@/server/d4h-access-token";
import {
    fetchD4HCurrentTeamMembers,
    getD4HTokenMetadata,
    type D4HMemberWithOptionalEmail,
} from "@/server/d4h-api/client";
import { hashLinkToken } from "@/server/link-token";
import { createLogBatch, type LogEntryRef } from "@/server/log-entry";
import { isUniqueViolation } from "@/server/prisma-errors";

import * as OrgSettings from "./organization-settings";
import { unattendedOrgContext, type OrgServiceContext } from "./service-context";

// Runnability (decision 6)

/** The D4H calls behind a rule's runnability, injectable so tests don't need D4H. */
export interface RunnabilityDeps {
    /** The module's D4H token (`modules.d4h-nag.d4hTokenId`), or `null` when it doesn't resolve. */
    getToken: (
        prisma: Pick<PrismaClient, "organizationConfig">,
        organizationId: OrgServiceContext["organizationId"],
    ) => Promise<D4HAccessToken_ServerOnly | null>;
    /** The D4H teams the token can see. */
    getTokenMetadata: (token: D4HAccessToken_ServerOnly) => Promise<D4HAccessTokenMetadata>;
}

export const defaultRunnabilityDeps: RunnabilityDeps = {
    getToken: getD4HNagAccessToken,
    getTokenMetadata: (token) => getD4HTokenMetadata(toD4HCredentialRef(token)),
};

/**
 * Whether a rule can run. A runnable rule comes with what a run needs: the module's token, the
 * D4H team and the org's timezone. A paused one comes with the first check that failed.
 */
export type Runnability =
    | {
          runnable: true;
          token: D4HAccessToken_ServerOnly;
          d4hTeamId: number;
          timeZone: string;
      }
    | { runnable: false; reason: D4HNagPausedReason };

/** The parts of a rule (and its team) the runnability checks read. */
interface RunnabilityInput {
    enabled: boolean;
    team: { status: RecordStatus; d4h: { d4hTeamId: number } | null };
}

/** The context the runnability checks need: no user, so the cron can call them too. */
type UnattendedContext = Pick<OrgServiceContext, "prisma" | "organizationId">;

/**
 * A runnability check for one org's rules. The settings, the token and its metadata are each
 * read at most once, however many rules it's asked about.
 */
function createRunnabilityResolver(ctx: UnattendedContext, deps: RunnabilityDeps) {
    let settings: ReturnType<typeof OrgSettings.read> | undefined;
    let token: Promise<D4HAccessToken_ServerOnly | null> | undefined;
    let metadata: Promise<D4HAccessTokenMetadata> | undefined;

    return async function resolve(rule: RunnabilityInput): Promise<Runnability> {
        const paused = (reason: D4HNagPausedReason): Runnability => ({ runnable: false, reason });

        settings ??= OrgSettings.read(ctx.prisma, ctx.organizationId);
        const { general, integrations } = await settings;
        if (!integrations.d4h.enabled) return paused("d4h-disabled");
        if (!rule.enabled) return paused("disabled");
        if (rule.team.status !== "Active") return paused("team-inactive");

        const link = rule.team.d4h;
        if (!link) return paused("team-unlinked");

        token ??= deps.getToken(ctx.prisma, ctx.organizationId);
        const resolvedToken = await token;
        if (!resolvedToken) return paused("no-token");

        metadata ??= deps.getTokenMetadata(resolvedToken);
        const { d4HTeams } = await metadata;
        if (!d4HTeams.some((team) => team.id === link.d4hTeamId)) {
            return paused("token-cannot-see-team");
        }

        return {
            runnable: true,
            token: resolvedToken,
            d4hTeamId: link.d4hTeamId,
            timeZone: general.timeZone,
        };
    };
}

const ruleTeamSelect = {
    select: { id: true, name: true, status: true, d4h: { select: { d4hTeamId: true } } },
} as const;

/**
 * Whether the rule can run now (decision 6), checked in order: the D4H integration is on, the
 * rule is enabled, its team is active and linked to D4H, the module has a D4H token, and that
 * token can see the team. Module usability is not checked here.
 * @throws NotFoundError if the rule does not exist within the organization.
 * @throws whatever the token metadata lookup throws (a D4H failure).
 */
export async function checkRunnable(
    ctx: UnattendedContext,
    ruleId: D4HNagRuleId,
    deps: RunnabilityDeps = defaultRunnabilityDeps,
): Promise<Runnability> {
    const rule = await ctx.prisma.d4HNagRule.findUnique({
        where: { id: ruleId, organizationId: ctx.organizationId },
        select: { enabled: true, team: ruleTeamSelect },
    });
    if (!rule) throw new NotFoundError(`D4HNagRule(id=${ruleId}) not found.`);

    return createRunnabilityResolver(ctx, deps)(rule);
}

// Rules

/** The audit ref that files a rule or opt-out entry on its team's history too. */
function teamRef(teamId: string): LogEntryRef {
    return { objectType: "Team", objectId: teamId, role: "context" };
}

/** The rule fields an audit entry diffs. */
function loggedRuleFields(rule: {
    weekday: number;
    hour: number;
    lookAheadHours: number;
    message: string;
    enabled: boolean;
}) {
    const { weekday, hour, lookAheadHours, message, enabled } = rule;
    return { weekday, hour, lookAheadHours, message, enabled };
}

/** What a rule item reads: the rule, its team and its latest run. */
const ruleItemInclude = {
    team: ruleTeamSelect,
    runs: {
        select: { id: true, startedAt: true, status: true },
        orderBy: { startedAt: "desc" },
        take: 1,
    },
} as const;

/** A rule with its team, its schedule in words, why it's paused and its latest run. */
async function ruleItem(
    {
        team,
        runs,
        ...rule
    }: D4HNagRuleRecord & {
        team: { id: string; name: string; status: RecordStatus; d4h: { d4hTeamId: number } | null };
        runs: { id: string; startedAt: Date; status: D4HNagRunRecord["status"] }[];
    },
    resolve: ReturnType<typeof createRunnabilityResolver>,
): Promise<D4HNagRuleListItem> {
    const runnability = await resolve({ enabled: rule.enabled, team });
    const [lastRun] = runs;
    return {
        ...D4HNagRuleData.fromRecord(rule),
        team: { id: TeamId.schema.parse(team.id), name: team.name },
        schedule: describeSchedule(rule),
        pausedReason: runnability.runnable ? null : runnability.reason,
        lastRun: lastRun
            ? {
                  id: D4HNagRunId.schema.parse(lastRun.id),
                  startedAt: lastRun.startedAt.toISOString(),
                  status: lastRun.status,
              }
            : null,
    };
}

/**
 * The organization's rules, by team name then schedule, each with its team, its schedule in
 * words, why it's paused (`null` when runnable) and its latest run.
 * @throws whatever the token metadata lookup throws (a D4H failure).
 */
export async function listRules(
    ctx: OrgServiceContext,
    deps: RunnabilityDeps = defaultRunnabilityDeps,
): Promise<D4HNagRuleListItem[]> {
    const rules = await ctx.prisma.d4HNagRule.findMany({
        where: { organizationId: ctx.organizationId },
        include: ruleItemInclude,
    });

    rules.sort(
        (a, b) =>
            a.team.name.localeCompare(b.team.name) || a.weekday - b.weekday || a.hour - b.hour,
    );

    const resolve = createRunnabilityResolver(ctx, deps);
    const items: D4HNagRuleListItem[] = [];
    for (const rule of rules) {
        items.push(await ruleItem(rule, resolve));
    }
    return items;
}

/**
 * Fetch a rule as the rule page shows it: with its team, its schedule in words, why it's paused
 * (`null` when runnable) and its latest run, as `listRules` gives each rule.
 * @throws NotFoundError if the rule does not exist within the organization.
 * @throws whatever the token metadata lookup throws (a D4H failure).
 */
export async function requireRuleItemById(
    ctx: OrgServiceContext,
    ruleId: D4HNagRuleId,
    deps: RunnabilityDeps = defaultRunnabilityDeps,
): Promise<D4HNagRuleListItem> {
    const rule = await ctx.prisma.d4HNagRule.findUnique({
        where: { id: ruleId, organizationId: ctx.organizationId },
        include: ruleItemInclude,
    });
    if (!rule) throw new NotFoundError(`D4HNagRule(id=${ruleId}) not found.`);

    return ruleItem(rule, createRunnabilityResolver(ctx, deps));
}

/**
 * Fetch a rule by ID and ensure it belongs to the organization.
 * @throws NotFoundError if the rule does not exist within the organization.
 */
export async function requireRuleById(
    ctx: OrgServiceContext,
    ruleId: D4HNagRuleId,
): Promise<D4HNagRuleData> {
    const rule = await ctx.prisma.d4HNagRule.findUnique({
        where: { id: ruleId, organizationId: ctx.organizationId },
    });

    if (!rule) throw new NotFoundError(`D4HNagRule(id=${ruleId}) not found.`);

    return D4HNagRuleData.fromRecord(rule);
}

/** The org's timezone, read uncached like the rest of the module's settings reads. */
async function orgTimeZone(ctx: OrgServiceContext): Promise<string> {
    const settings = await OrgSettings.read(ctx.prisma, ctx.organizationId);
    return settings.general.timeZone;
}

/**
 * Create a rule for one of the organization's teams. `lastScheduledFor` starts at the rule's
 * latest slot, so a slot that has already passed this week never fires (decision 8).
 * @throws NotFoundError if the team does not exist within the organization.
 */
export async function createRule(
    ctx: OrgServiceContext,
    input: CreateD4HNagRuleData,
): Promise<D4HNagRuleData> {
    const team = await ctx.prisma.team.findUnique({
        where: { id: input.teamId, organizationId: ctx.organizationId },
        select: { id: true, name: true },
    });
    if (!team) throw new NotFoundError(`Team(id=${input.teamId}) not found.`);

    const id = D4HNagRuleId.create();
    const fields = loggedRuleFields(input);
    const lastScheduledFor = latestSlot(input, await orgTimeZone(ctx), new Date());

    const [created] = await ctx.prisma.$transaction([
        ctx.prisma.d4HNagRule.create({
            data: {
                id,
                organizationId: ctx.organizationId,
                teamId: team.id,
                ...fields,
                lastScheduledFor,
                createdById: ctx.userId,
            },
        }),
        ctx.logEvent({
            action: "Create",
            objectType: "D4HNagRule",
            objectId: id,
            changes: diffObject({}, { teamId: team.id, ...fields }),
            description: `${team.name}: ${describeSchedule(input)}`,
            refs: [teamRef(team.id)],
        }),
    ]);

    return D4HNagRuleData.fromRecord(created);
}

/**
 * Update a rule's schedule, window, message or enabled state. No-op, returning the rule
 * unchanged, if nothing differs. Enabling the rule or changing its weekday or hour moves
 * `lastScheduledFor` to the new latest slot, so a slot that has already passed never fires
 * because of the edit (decision 8).
 * @throws NotFoundError if the rule does not exist within the organization.
 */
export async function updateRule(
    ctx: OrgServiceContext,
    ruleId: D4HNagRuleId,
    input: UpdateD4HNagRuleData,
): Promise<D4HNagRuleData> {
    const existing = await requireRuleById(ctx, ruleId);

    const before = loggedRuleFields(existing);
    const after = loggedRuleFields({
        weekday: input.weekday ?? existing.weekday,
        hour: input.hour ?? existing.hour,
        lookAheadHours: input.lookAheadHours ?? existing.lookAheadHours,
        message: input.message ?? existing.message,
        enabled: input.enabled ?? existing.enabled,
    });

    const changes = diffObject(before, after);
    if (changes.length === 0) return existing;

    const reschedule =
        (after.enabled && !before.enabled) ||
        after.weekday !== before.weekday ||
        after.hour !== before.hour;
    const lastScheduledFor = reschedule
        ? latestSlot(after, await orgTimeZone(ctx), new Date())
        : undefined;

    const [updated] = await ctx.prisma.$transaction([
        ctx.prisma.d4HNagRule.update({
            where: { id: ruleId, organizationId: ctx.organizationId },
            data: { ...after, lastScheduledFor },
        }),
        ctx.logEvent({
            action: "Update",
            objectType: "D4HNagRule",
            objectId: ruleId,
            changes,
            refs: [teamRef(existing.teamId)],
        }),
    ]);

    return D4HNagRuleData.fromRecord(updated);
}

/**
 * Permanently delete a rule. Its runs are kept, with `ruleId` set to null by the foreign key
 * (decision 7); rules aren't in the Rubbish bin. The log entry's description keeps the team and
 * schedule.
 * @throws NotFoundError if the rule does not exist within the organization.
 */
export async function deleteRule(
    ctx: OrgServiceContext,
    ruleId: D4HNagRuleId,
): Promise<D4HNagRuleData> {
    const rule = await ctx.prisma.d4HNagRule.findUnique({
        where: { id: ruleId, organizationId: ctx.organizationId },
        include: { team: { select: { name: true } } },
    });
    if (!rule) throw new NotFoundError(`D4HNagRule(id=${ruleId}) not found.`);

    await ctx.prisma.$transaction([
        ctx.prisma.d4HNagRule.delete({
            where: { id: ruleId, organizationId: ctx.organizationId },
        }),
        ctx.logEvent({
            action: "Delete",
            objectType: "D4HNagRule",
            objectId: ruleId,
            description: `${rule.team.name}: ${describeSchedule(rule)}`,
            refs: [teamRef(rule.teamId)],
        }),
    ]);

    return D4HNagRuleData.fromRecord(rule);
}

/** The organization's active teams that are linked to D4H, by name: the teams a rule can be for. */
export async function listEligibleTeams(ctx: OrgServiceContext): Promise<D4HNagEligibleTeam[]> {
    const teams = await ctx.prisma.team.findMany({
        where: { organizationId: ctx.organizationId, status: "Active" },
        select: {
            id: true,
            name: true,
            d4h: { select: { d4hTeamId: true, d4hTeamName: true } },
        },
        orderBy: { name: "asc" },
    });

    return teams.flatMap(({ id, name, d4h }) =>
        d4h
            ? [
                  {
                      id: TeamId.schema.parse(id),
                      name,
                      d4hTeamId: d4h.d4hTeamId,
                      d4hTeamName: d4h.d4hTeamName,
                  },
              ]
            : [],
    );
}

/** What listing a team's D4H members reaches outside the database, injectable for tests. */
export interface TeamMembersDeps extends RunnabilityDeps {
    fetchTeamMembers: (
        token: D4HAccessToken_ServerOnly,
        d4hTeamId: number,
    ) => Promise<Pick<D4HMemberWithOptionalEmail, "id" | "name">[]>;
}

export const defaultTeamMembersDeps: TeamMembersDeps = {
    ...defaultRunnabilityDeps,
    fetchTeamMembers: fetchD4HCurrentTeamMembers,
};

/**
 * A team's current D4H members by name, read through the module's D4H token, for an admin
 * picking whom to opt out. The team must pass the same checks a rule for it would (decision 6,
 * less the rule's own enabled flag); otherwise the first that fails comes back as the reason.
 * @throws NotFoundError if the team does not exist within the organization.
 * @throws whatever the D4H calls throw.
 */
export async function listTeamD4HMembers(
    ctx: UnattendedContext,
    teamId: TeamId,
    deps: TeamMembersDeps = defaultTeamMembersDeps,
): Promise<D4HNagTeamMembers> {
    const team = await ctx.prisma.team.findUnique({
        where: { id: teamId, organizationId: ctx.organizationId },
        ...ruleTeamSelect,
    });
    if (!team) throw new NotFoundError(`Team(id=${teamId}) not found.`);

    const runnability = await createRunnabilityResolver(ctx, deps)({ enabled: true, team });
    if (!runnability.runnable) return { state: "not-runnable", reason: runnability.reason };

    const members = await deps.fetchTeamMembers(runnability.token, runnability.d4hTeamId);
    return {
        state: "ok",
        members: members
            .map((member) => ({ d4hMemberId: member.id, name: member.name }))
            .sort((a, b) => a.name.localeCompare(b.name)),
    };
}

// Opt-outs

/** The organization's opt-outs, by team name then member name. */
export async function listOptOuts(ctx: OrgServiceContext): Promise<D4HNagOptOutListItem[]> {
    const optOuts = await ctx.prisma.d4HNagOptOut.findMany({
        where: { organizationId: ctx.organizationId },
        include: {
            team: { select: { id: true, name: true } },
            createdBy: { select: { id: true, name: true } },
        },
    });

    optOuts.sort(
        (a, b) =>
            a.team.name.localeCompare(b.team.name) || a.memberName.localeCompare(b.memberName),
    );

    return optOuts.map((optOut) => ({
        ...optOutItem(optOut),
        team: { id: TeamId.schema.parse(optOut.team.id), name: optOut.team.name },
        createdBy: optOut.createdBy ?? null,
    }));
}

function optOutItem(record: D4HNagOptOutRecord) {
    return {
        id: D4HNagOptOutId.schema.parse(record.id),
        d4hMemberId: record.d4hMemberId,
        memberName: record.memberName,
        source: record.source,
        createdAt: record.createdAt.toISOString(),
    };
}

/**
 * Opt a D4H member out of reminders for one of the organization's teams, on an admin's behalf
 * (`source: Admin`).
 * @throws NotFoundError if the team does not exist within the organization.
 * @throws ConflictError if the member has already opted out for that team.
 */
export async function addOptOut(
    ctx: OrgServiceContext,
    input: AddD4HNagOptOutData,
): Promise<D4HNagOptOutListItem> {
    const team = await ctx.prisma.team.findUnique({
        where: { id: input.teamId, organizationId: ctx.organizationId },
        select: { id: true, name: true },
    });
    if (!team) throw new NotFoundError(`Team(id=${input.teamId}) not found.`);

    const conflict = () =>
        new ConflictError(`${input.memberName} has already opted out for ${team.name}.`);

    const existing = await ctx.prisma.d4HNagOptOut.findUnique({
        where: { teamId_d4hMemberId: { teamId: team.id, d4hMemberId: input.d4hMemberId } },
        select: { id: true },
    });
    if (existing) throw conflict();

    const id = D4HNagOptOutId.create();
    try {
        const [created] = await ctx.prisma.$transaction([
            ctx.prisma.d4HNagOptOut.create({
                data: {
                    id,
                    organizationId: ctx.organizationId,
                    teamId: team.id,
                    d4hMemberId: input.d4hMemberId,
                    memberName: input.memberName,
                    source: "Admin",
                    createdById: ctx.userId,
                },
                include: { createdBy: { select: { id: true, name: true } } },
            }),
            ctx.logEvent({
                action: "Create",
                objectType: "D4HNagOptOut",
                objectId: id,
                changes: diffObject(
                    {},
                    { d4hMemberId: input.d4hMemberId, memberName: input.memberName },
                ),
                description: input.memberName,
                refs: [teamRef(team.id)],
            }),
        ]);

        return {
            ...optOutItem(created),
            team: { id: TeamId.schema.parse(team.id), name: team.name },
            createdBy: created.createdBy ?? null,
        };
    } catch (error) {
        if (isUniqueViolation(error)) throw conflict();
        throw error;
    }
}

/**
 * Remove an opt-out, so the member gets reminders for that team again.
 * @throws NotFoundError if the opt-out does not exist within the organization.
 */
export async function removeOptOut(
    ctx: OrgServiceContext,
    optOutId: D4HNagOptOutId,
): Promise<void> {
    const optOut = await ctx.prisma.d4HNagOptOut.findUnique({
        where: { id: optOutId, organizationId: ctx.organizationId },
        select: { teamId: true, memberName: true },
    });
    if (!optOut) throw new NotFoundError(`D4HNagOptOut(id=${optOutId}) not found.`);

    await ctx.prisma.$transaction([
        ctx.prisma.d4HNagOptOut.delete({
            where: { id: optOutId, organizationId: ctx.organizationId },
        }),
        ctx.logEvent({
            action: "Delete",
            objectType: "D4HNagOptOut",
            objectId: optOutId,
            description: optOut.memberName,
            refs: [teamRef(optOut.teamId)],
        }),
    ]);
}

// Self-service opt-out by link token (decisions 19, 20, 22)

/** The public opt-out functions' context: no organization or user until the token names one. */
type PublicContext = Pick<OrgServiceContext, "prisma">;

/**
 * Resolve an email's link token to its recipient, and the AVUT teams whose opt-outs apply to
 * them: every team in the org currently linked to the recipient's D4H team, the same set the
 * runner reads (decision 19). A self opt-out goes on the run's team while it is still in that
 * set, otherwise on the first linked team; `optOutTeamId` is `null` when no team is linked, as
 * nothing can then send to them. The team the page names comes from the run, never the rule, so
 * the link outlives the rule (decision 7). `null` for a token no recipient row holds.
 */
async function resolveLinkToken(ctx: PublicContext, token: string) {
    const recipient = await ctx.prisma.d4HNagRecipient.findUnique({
        where: { tokenHash: hashLinkToken(token) },
        select: {
            organizationId: true,
            d4hTeamId: true,
            d4hMemberId: true,
            memberName: true,
            organization: { select: { name: true } },
            run: { select: { team: { select: { id: true, name: true } } } },
        },
    });
    if (!recipient) return null;

    const organizationId = OrganizationId.schema.parse(recipient.organizationId);
    const links = await ctx.prisma.team_D4H.findMany({
        where: { d4hTeamId: recipient.d4hTeamId },
        select: { teamId: true },
    });
    const linkedTeams = await ctx.prisma.team.findMany({
        where: { id: { in: links.map((link) => link.teamId) }, organizationId },
        select: { id: true },
        orderBy: { id: "asc" },
    });

    const team = recipient.run.team;
    const teamIds = linkedTeams.map((linked) => linked.id);
    return {
        organizationId,
        organizationName: recipient.organization.name,
        team,
        d4hMemberId: recipient.d4hMemberId,
        memberName: recipient.memberName,
        teamIds,
        optOutTeamId: teamIds.includes(team.id) ? team.id : (teamIds[0] ?? null),
    };
}

type LinkTokenScope = NonNullable<Awaited<ReturnType<typeof resolveLinkToken>>>;

/** The member's opt-out rows on any of the scope's teams. */
async function findScopeOptOuts(ctx: PublicContext, scope: LinkTokenScope) {
    if (scope.teamIds.length === 0) return [];
    return await ctx.prisma.d4HNagOptOut.findMany({
        where: {
            organizationId: scope.organizationId,
            teamId: { in: scope.teamIds },
            d4hMemberId: scope.d4hMemberId,
        },
        select: { id: true, teamId: true, memberName: true },
    });
}

function optOutState(scope: LinkTokenScope, optedOut: boolean): D4HNagOptOutByToken {
    return {
        state: "ok",
        organizationName: scope.organizationName,
        teamName: scope.team.name,
        memberName: scope.memberName,
        optedOut,
    };
}

/**
 * The public opt-out page's view of a link token: the org, team and member it was sent to, and
 * whether the member has opted out on any AVUT team in the org linked to that D4H team.
 * `not-found` for a token no recipient row holds (never issued, or purged).
 */
export async function getOptOutByToken(
    ctx: PublicContext,
    token: string,
): Promise<D4HNagOptOutByToken> {
    const scope = await resolveLinkToken(ctx, token);
    if (!scope) return { state: "not-found" };

    const optOuts = await findScopeOptOuts(ctx, scope);
    return optOutState(scope, optOuts.length > 0);
}

/**
 * Opt the link token's member out (`source: Self`, on the scope's `optOutTeamId`) or back in
 * (removing their rows on every team in scope). A no-op when they're already in the requested
 * state, or when no team in the org is linked to their D4H team any more (nothing can send to
 * them, so they read as opted in). A change is audited under a `d4h-nag-opt-out` batch labelled
 * with the member's name, since there is no user behind it (decision 22): one entry per row
 * created or removed.
 */
export async function setOptOutByToken(
    ctx: PublicContext,
    token: string,
    optedOut: boolean,
): Promise<D4HNagOptOutByToken> {
    const scope = await resolveLinkToken(ctx, token);
    if (!scope) return { state: "not-found" };
    const { optOutTeamId } = scope;
    if (optOutTeamId === null) return optOutState(scope, false);

    const existing = await findScopeOptOuts(ctx, scope);

    if (optedOut && existing.length === 0) {
        const logCtx = await openSelfServiceBatch(ctx, scope);
        const id = D4HNagOptOutId.create();
        try {
            await ctx.prisma.$transaction([
                ctx.prisma.d4HNagOptOut.create({
                    data: {
                        id,
                        organizationId: scope.organizationId,
                        teamId: optOutTeamId,
                        d4hMemberId: scope.d4hMemberId,
                        memberName: scope.memberName,
                        source: "Self",
                        createdById: null,
                    },
                }),
                logCtx.logEvent({
                    action: "Create",
                    objectType: "D4HNagOptOut",
                    objectId: id,
                    changes: diffObject(
                        {},
                        {
                            teamId: optOutTeamId,
                            d4hMemberId: scope.d4hMemberId,
                            memberName: scope.memberName,
                        },
                    ),
                    description: scope.memberName,
                    refs: [teamRef(optOutTeamId)],
                }),
            ]);
        } catch (error) {
            // A concurrent request opted them out first: the state asked for already holds.
            if (!isUniqueViolation(error)) throw error;
        }
    }

    if (!optedOut && existing.length > 0) {
        const logCtx = await openSelfServiceBatch(ctx, scope);
        await ctx.prisma.$transaction([
            ctx.prisma.d4HNagOptOut.deleteMany({
                where: { id: { in: existing.map((optOut) => optOut.id) } },
            }),
            ...existing.map((optOut) =>
                logCtx.logEvent({
                    action: "Delete",
                    objectType: "D4HNagOptOut",
                    objectId: optOut.id,
                    description: optOut.memberName,
                    refs: [teamRef(optOut.teamId)],
                }),
            ),
        ]);
    }

    return optOutState(scope, optedOut);
}

/**
 * Open the `d4h-nag-opt-out` batch for a self-service change and the actor-less context whose
 * entries join it, labelled with the member's cached name (decision 22).
 */
async function openSelfServiceBatch(ctx: PublicContext, scope: LinkTokenScope) {
    const batch = await createLogBatch(
        { operationKey: "d4h-nag-opt-out", actorLabel: scope.memberName },
        ctx.prisma,
    );
    return unattendedOrgContext(ctx.prisma, scope.organizationId, {
        id: batch.id,
        actorLabel: scope.memberName,
    });
}

// Runs

function runItem(run: D4HNagRunRecord): D4HNagRunListItem {
    return {
        id: D4HNagRunId.schema.parse(run.id),
        ruleId: run.ruleId === null ? null : D4HNagRuleId.schema.parse(run.ruleId),
        teamId: TeamId.schema.parse(run.teamId),
        teamName: run.teamName,
        trigger: run.trigger,
        dryRun: run.dryRun,
        status: run.status,
        error: run.error,
        startedAt: run.startedAt.toISOString(),
        completedAt: run.completedAt?.toISOString() ?? null,
        windowStart: run.windowStart.toISOString(),
        windowEnd: run.windowEnd.toISOString(),
        exercisesFound: run.exercisesFound,
        sentCount: run.sentCount,
        skippedCount: run.skippedCount,
        failedCount: run.failedCount,
    };
}

/** The organization's runs, newest first; only one rule's when `ruleId` is given. */
export async function listRuns(
    ctx: OrgServiceContext,
    { ruleId }: { ruleId?: D4HNagRuleId } = {},
): Promise<D4HNagRunListItem[]> {
    const runs = await ctx.prisma.d4HNagRun.findMany({
        where: { organizationId: ctx.organizationId, ...(ruleId ? { ruleId } : {}) },
        orderBy: { startedAt: "desc" },
    });

    return runs.map(runItem);
}

function recipientItem(recipient: D4HNagRecipientRecord): D4HNagRecipientItem {
    return {
        id: D4HNagRecipientId.schema.parse(recipient.id),
        d4hExerciseId: recipient.d4hExerciseId,
        exerciseTitle: recipient.exerciseTitle,
        exerciseStartsAt: recipient.exerciseStartsAt.toISOString(),
        d4hMemberId: recipient.d4hMemberId,
        memberName: recipient.memberName,
        email: recipient.email,
        outcome: recipient.outcome,
    };
}

/**
 * Fetch a run with who started it and its recipients, by exercise start then member name. The
 * recipients never carry their token hash or dedupe key.
 * @throws NotFoundError if the run does not exist within the organization.
 */
export async function requireRunById(
    ctx: OrgServiceContext,
    runId: D4HNagRunId,
): Promise<D4HNagRunDetail> {
    const run = await ctx.prisma.d4HNagRun.findUnique({
        where: { id: runId, organizationId: ctx.organizationId },
        include: { recipients: true, startedBy: { select: { id: true, name: true } } },
    });
    if (!run) throw new NotFoundError(`D4HNagRun(id=${runId}) not found.`);

    const { recipients, startedBy, ...record } = run;
    recipients.sort(
        (a, b) =>
            a.exerciseStartsAt.getTime() - b.exerciseStartsAt.getTime() ||
            a.memberName.localeCompare(b.memberName),
    );

    return {
        ...runItem(record),
        startedBy: startedBy ?? null,
        recipients: recipients.map(recipientItem),
    };
}
