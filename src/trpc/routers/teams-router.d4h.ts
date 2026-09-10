/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 *  D4H linking & team synchronisation helpers for `teams-router.ts`.
 *  See docs/specs/d4h-linking.md and docs/plans/d4h-linking.md.
 */

import { TRPCError } from "@trpc/server";

import { Team_D4H as TeamD4HRecord } from "@/generated/prisma/client";

import { diffObject } from "@/lib/diff";
import { D4HMember } from "@/lib/schemas/d4h/member";
import { D4HAccessToken_ServerOnly } from "@/lib/schemas/d4h-access-token";
import { D4HLinkAction } from "@/server/d4h-link-invariants";
import { buildSyncPlan, snapshotFromD4HMember } from "@/server/d4h-sync";
import { SyncPlan } from "@/lib/schemas/d4h-sync-plan";
import { PersonId } from "@/lib/schemas/person";
import { TeamMembershipId } from "@/lib/schemas/team-membership";
import { getPersonalD4HAccessTokenForUser } from "@/server/d4h-access-token";
import {
    fetchD4HOrganisationCached,
    fetchD4HTeamDetailCached,
    fetchD4HTeamMembersForSync,
    getD4HTokenMetadata,
} from "@/server/d4h-api/client";
import { StalePlanError } from "@/trpc/errors";

import { AuthenticatedOrganizationContext } from "../init";

import { createPerson, getPersonByEmail } from "./personnel-router";

const personTeamRefs = (personId: string, teamId: string) => [
    { objectType: "Person" as const, objectId: personId, role: "context" as const },
    { objectType: "Team" as const, objectId: teamId, role: "context" as const },
];

/** The D4H team as resolved through the acting user's personal token. */
export type ResolvedD4HTeam = {
    token: D4HAccessToken_ServerOnly;
    d4hTeamId: number;
    d4hTeamName: string;
    owningOrgId: number | null;
    owningOrgName: string | null;
};

/**
 * Resolve a D4H team through the calling user's personal access token, verifying
 * the token can see it.
 */
export async function resolveD4HTeamForLink(
    ctx: AuthenticatedOrganizationContext,
    d4hTeamId: number,
): Promise<ResolvedD4HTeam> {
    const token = await getPersonalD4HAccessTokenForUser(ctx.organizationId, ctx.userId);
    if (!token) {
        throw new TRPCError({
            code: "BAD_REQUEST",
            message: "No personal D4H Access Token found for user",
        });
    }

    const { d4HTeams } = await getD4HTokenMetadata(token);
    const ref = d4HTeams.find((t) => t.id === d4hTeamId);
    if (!ref) {
        throw new TRPCError({
            code: "NOT_FOUND",
            message: `D4H Team ${d4hTeamId} not found or not accessible with your token.`,
        });
    }

    return {
        token,
        d4hTeamId: ref.id,
        d4hTeamName: ref.title,
        owningOrgId: ref.owner?.id ?? null,
        owningOrgName: ref.owner?.title ?? null,
    };
}

/**
 * Create the `Organization_D4H` row implied by a resolved link action, or do
 * nothing when reusing an existing org link.
 */
export async function upsertOrganizationD4H(
    ctx: AuthenticatedOrganizationContext,
    args: { action: D4HLinkAction; resolved: ResolvedD4HTeam; batchId: string },
): Promise<void> {
    const { action, resolved, batchId } = args;
    if (action.kind === "reuse") return;

    if (action.kind === "create-org-linked") {
        const d4hOrg = await fetchD4HOrganisationCached(
            resolved.token,
            resolved.d4hTeamId,
            action.d4hOrganisationId,
        );
        await ctx.prisma.$transaction([
            ctx.prisma.organization_D4H.create({
                data: {
                    organizationId: ctx.organizationId,
                    serverCode: resolved.token.serverCode,
                    d4hOrganisationId: action.d4hOrganisationId,
                    d4hOrganisationName: d4hOrg.title,
                    d4hTimezone: d4hOrg.timezone,
                    d4hCurrency: d4hOrg.currency,
                    d4hReportingStartDay: d4hOrg.reportingStartDay,
                    d4hReportingStartMonth: d4hOrg.reportingStartMonth,
                    lastSyncedAt: new Date(),
                },
            }),
            ctx.logEvent({
                action: "Update",
                objectType: "Organization",
                objectId: ctx.organizationId,
                description: `Linked to D4H organisation "${d4hOrg.title}".`,
                batchId,
            }),
        ]);
        return;
    }

    // create-org-less
    await ctx.prisma.$transaction([
        ctx.prisma.organization_D4H.create({
            data: {
                organizationId: ctx.organizationId,
                serverCode: resolved.token.serverCode,
                d4hOrganisationId: null,
            },
        }),
        ctx.logEvent({
            action: "Update",
            objectType: "Organization",
            objectId: ctx.organizationId,
            description: "Linked to an org-less D4H team.",
            batchId,
        }),
    ]);
}

type TeamMetaRecord = Record<string, string | number | null>;

type SyncInputs = {
    teamId: string;
    d4hMembers: D4HMember[];
    d4hMembersById: Map<number, D4HMember>;
    avutMemberships: Parameters<typeof buildSyncPlan>[0]["avutMemberships"];
    membershipPersonIds: Map<string, string>;
    existingPersonEmails: Set<string>;
    manualMembershipEmails: Set<string>;
    /** Flat metadata for the diff — Team_D4H fields plus, when org-bearing, org cache fields. */
    currentMeta: TeamMetaRecord;
    incomingMeta: TeamMetaRecord;
    /** The concrete field values to write on apply. */
    incomingTeamFields: {
        d4hTeamName: string;
        d4hOrganisationId: number | null;
        d4hTimezone: string | null;
    };
    incomingOrgFields: {
        d4hOrganisationName: string;
        d4hTimezone: string;
        d4hCurrency: string;
        d4hReportingStartDay: number;
        d4hReportingStartMonth: number;
    } | null;
};

/** Fetch both sides of a linked team and shape them for `buildSyncPlan` + apply. */
export async function fetchD4HSyncInputs(
    ctx: AuthenticatedOrganizationContext,
    args: { teamD4H: TeamD4HRecord; token: D4HAccessToken_ServerOnly },
): Promise<SyncInputs> {
    const { teamD4H, token } = args;
    const teamId = teamD4H.teamId;

    const [metadata, teamDetail, d4hMembers] = await Promise.all([
        getD4HTokenMetadata(token),
        fetchD4HTeamDetailCached(token, teamD4H.d4hTeamId),
        fetchD4HTeamMembersForSync(token, teamD4H.d4hTeamId),
    ]);

    const ref = metadata.d4HTeams.find((t) => t.id === teamD4H.d4hTeamId);
    if (!ref) {
        throw new TRPCError({
            code: "NOT_FOUND",
            message: `D4H Team ${teamD4H.d4hTeamId} is no longer accessible with your token.`,
        });
    }
    const owningOrgId = ref.owner?.id ?? null;

    const [managedRows, allPeople, manualRows] = await Promise.all([
        ctx.prisma.teamMembership.findMany({
            where: { teamId, organizationId: ctx.organizationId, d4h: { isNot: null } },
            include: { d4h: true, person: { select: { id: true, name: true, email: true } } },
        }),
        ctx.prisma.person.findMany({
            where: { organizationId: ctx.organizationId },
            select: { email: true },
        }),
        ctx.prisma.teamMembership.findMany({
            where: { teamId, organizationId: ctx.organizationId, d4h: { is: null } },
            include: { person: { select: { email: true } } },
        }),
    ]);

    const d4hMembersById = new Map(d4hMembers.map((m) => [m.id, m]));
    const membershipPersonIds = new Map<string, string>();
    const avutMemberships: SyncInputs["avutMemberships"] = managedRows.map((row) => {
        membershipPersonIds.set(row.id, row.personId);
        return {
            teamMembershipId: row.id,
            personName: row.person.name,
            membershipStatus: row.status as "Active" | "Archived" | "Deleted",
            snapshot: {
                d4hMemberId: row.d4h!.d4hMemberId,
                d4hStatus: row.d4h!.d4hStatus,
                d4hPosition: row.d4h!.d4hPosition,
                d4hRef: row.d4h!.d4hRef,
                d4hRoleId: row.d4h!.d4hRoleId,
            },
        };
    });

    // Resolve the incoming org cache (org-bearing teams only).
    let incomingOrgFields: SyncInputs["incomingOrgFields"] = null;
    let orgD4H: {
        d4hOrganisationName: string | null;
        d4hTimezone: string | null;
        d4hCurrency: string | null;
        d4hReportingStartDay: number | null;
        d4hReportingStartMonth: number | null;
    } | null = null;

    if (owningOrgId !== null) {
        const [d4hOrg, orgRow] = await Promise.all([
            fetchD4HOrganisationCached(token, teamD4H.d4hTeamId, owningOrgId),
            ctx.prisma.organization_D4H.findUnique({
                where: { organizationId: ctx.organizationId },
            }),
        ]);
        incomingOrgFields = {
            d4hOrganisationName: d4hOrg.title,
            d4hTimezone: d4hOrg.timezone,
            d4hCurrency: d4hOrg.currency,
            d4hReportingStartDay: d4hOrg.reportingStartDay,
            d4hReportingStartMonth: d4hOrg.reportingStartMonth,
        };
        orgD4H = orgRow;
    }

    const incomingTeamFields = {
        d4hTeamName: ref.title,
        d4hOrganisationId: owningOrgId,
        d4hTimezone: teamDetail.timezone,
    };

    const currentMeta: TeamMetaRecord = {
        d4hTeamName: teamD4H.d4hTeamName,
        d4hOrganisationId: teamD4H.d4hOrganisationId,
        d4hTimezone: teamD4H.d4hTimezone,
        ...(incomingOrgFields
            ? {
                  orgName: orgD4H?.d4hOrganisationName ?? null,
                  orgTimezone: orgD4H?.d4hTimezone ?? null,
                  orgCurrency: orgD4H?.d4hCurrency ?? null,
                  orgReportingStartDay: orgD4H?.d4hReportingStartDay ?? null,
                  orgReportingStartMonth: orgD4H?.d4hReportingStartMonth ?? null,
              }
            : {}),
    };
    const incomingMeta: TeamMetaRecord = {
        d4hTeamName: incomingTeamFields.d4hTeamName,
        d4hOrganisationId: incomingTeamFields.d4hOrganisationId,
        d4hTimezone: incomingTeamFields.d4hTimezone,
        ...(incomingOrgFields
            ? {
                  orgName: incomingOrgFields.d4hOrganisationName,
                  orgTimezone: incomingOrgFields.d4hTimezone,
                  orgCurrency: incomingOrgFields.d4hCurrency,
                  orgReportingStartDay: incomingOrgFields.d4hReportingStartDay,
                  orgReportingStartMonth: incomingOrgFields.d4hReportingStartMonth,
              }
            : {}),
    };

    return {
        teamId,
        d4hMembers,
        d4hMembersById,
        avutMemberships,
        membershipPersonIds,
        existingPersonEmails: new Set(allPeople.map((p) => p.email.toLowerCase())),
        manualMembershipEmails: new Set(manualRows.map((r) => r.person.email.toLowerCase())),
        currentMeta,
        incomingMeta,
        incomingTeamFields,
        incomingOrgFields,
    };
}

export function planFromInputs(inputs: SyncInputs): SyncPlan {
    return buildSyncPlan({
        teamId: inputs.teamId,
        d4hMembers: inputs.d4hMembers,
        avutMemberships: inputs.avutMemberships,
        existingPersonEmails: inputs.existingPersonEmails,
        manualMembershipEmails: inputs.manualMembershipEmails,
        teamMetadata: { current: inputs.currentMeta, incoming: inputs.incomingMeta },
    });
}

/** Build a fresh plan for a linked team, no writes. */
export async function planD4HSync(
    ctx: AuthenticatedOrganizationContext,
    args: { teamD4H: TeamD4HRecord; token: D4HAccessToken_ServerOnly },
): Promise<SyncPlan> {
    return planFromInputs(await fetchD4HSyncInputs(ctx, args));
}

/** Apply an already-computed plan. One `$transaction` per independently-meaningful row. */
async function applyD4HSyncPlan(
    ctx: AuthenticatedOrganizationContext,
    args: { plan: SyncPlan; inputs: SyncInputs; batchId: string },
): Promise<void> {
    const { plan, inputs, batchId } = args;
    const teamId = inputs.teamId;
    const now = new Date();

    for (const add of plan.additions) {
        const member = inputs.d4hMembersById.get(add.d4hMemberId);
        if (!member) continue;
        const snap = snapshotFromD4HMember(member);

        let person = await getPersonByEmail(ctx, add.email);
        if (!person) {
            person = (
                await createPerson(
                    ctx,
                    PersonId.create(),
                    { name: add.name, email: add.email, tags: [], properties: {} },
                    batchId,
                )
            ).created;
        }

        const existing = await ctx.prisma.teamMembership.findUnique({
            where: { teamId_personId: { teamId, personId: person.id } },
            select: { id: true, status: true },
        });

        if (existing) {
            await ctx.prisma.$transaction([
                ctx.prisma.teamMembership.update({
                    where: { id: existing.id },
                    data: {
                        status: "Active",
                        d4h: { create: { d4hMemberId: add.d4hMemberId, ...snap } },
                    },
                }),
                ctx.logEvent({
                    action: "Update",
                    objectType: "TeamMembership",
                    objectId: existing.id,
                    description: "Adopted a manual membership as D4H-managed.",
                    changes: diffObject({ status: existing.status }, { status: "Active" }),
                    batchId,
                    refs: personTeamRefs(person.id, teamId),
                }),
            ]);
        } else {
            const tmId = TeamMembershipId.create();
            await ctx.prisma.$transaction([
                ctx.prisma.teamMembership.create({
                    data: {
                        id: tmId,
                        organizationId: ctx.organizationId,
                        teamId,
                        personId: person.id,
                        status: "Active",
                        d4h: { create: { d4hMemberId: add.d4hMemberId, ...snap } },
                    },
                }),
                ctx.logEvent({
                    action: "Create",
                    objectType: "TeamMembership",
                    objectId: tmId,
                    description: "Added from linked D4H team.",
                    batchId,
                    refs: personTeamRefs(person.id, teamId),
                }),
            ]);
        }
    }

    for (const upd of plan.updates) {
        const member = inputs.d4hMembersById.get(upd.d4hMemberId);
        if (!member) continue;
        await ctx.prisma.$transaction([
            ctx.prisma.teamMembership_D4H.update({
                where: { teamMembershipId: upd.teamMembershipId },
                data: snapshotFromD4HMember(member),
            }),
            ctx.logEvent({
                action: "Update",
                objectType: "TeamMembership",
                objectId: upd.teamMembershipId,
                changes: upd.changes,
                batchId,
                refs: personTeamRefs(
                    inputs.membershipPersonIds.get(upd.teamMembershipId) ?? upd.teamMembershipId,
                    teamId,
                ),
            }),
        ]);
    }

    for (const react of plan.reactivations) {
        const member = inputs.d4hMembersById.get(react.d4hMemberId);
        if (!member) continue;
        await ctx.prisma.$transaction([
            ctx.prisma.teamMembership.update({
                where: { id: react.teamMembershipId },
                data: { status: "Active" },
            }),
            ctx.prisma.teamMembership_D4H.update({
                where: { teamMembershipId: react.teamMembershipId },
                data: snapshotFromD4HMember(member),
            }),
            ctx.logEvent({
                action: "Update",
                objectType: "TeamMembership",
                objectId: react.teamMembershipId,
                description: "Reactivated — member is back in the linked D4H team.",
                changes: [
                    ...diffObject({ status: "Archived" }, { status: "Active" }),
                    ...react.changes,
                ],
                batchId,
                refs: personTeamRefs(
                    inputs.membershipPersonIds.get(react.teamMembershipId) ??
                        react.teamMembershipId,
                    teamId,
                ),
            }),
        ]);
    }

    for (const arch of plan.archivals) {
        await ctx.prisma.$transaction([
            ctx.prisma.teamMembership.update({
                where: { id: arch.teamMembershipId },
                data: { status: "Archived" },
            }),
            ctx.logEvent({
                action: "Update",
                objectType: "TeamMembership",
                objectId: arch.teamMembershipId,
                description: "Archived — member is no longer in the linked D4H team.",
                changes: diffObject({ status: "Active" }, { status: "Archived" }),
                batchId,
                refs: personTeamRefs(
                    inputs.membershipPersonIds.get(arch.teamMembershipId) ?? arch.teamMembershipId,
                    teamId,
                ),
            }),
        ]);
    }

    // Team_D4H metadata refresh — always bump lastSyncedAt; log only a non-empty diff.
    const teamKeys = ["d4hTeamName", "d4hOrganisationId", "d4hTimezone"] as const;
    const teamDiff = diffObject(
        Object.fromEntries(teamKeys.map((k) => [k, inputs.currentMeta[k] ?? null])),
        Object.fromEntries(teamKeys.map((k) => [k, inputs.incomingMeta[k] ?? null])),
    );
    if (teamDiff.length > 0) {
        await ctx.prisma.$transaction([
            ctx.prisma.team_D4H.update({
                where: { teamId },
                data: { lastSyncedAt: now, ...inputs.incomingTeamFields },
            }),
            ctx.logEvent({
                action: "Update",
                objectType: "Team",
                objectId: teamId,
                description: "Refreshed D4H team metadata.",
                changes: teamDiff,
                batchId,
            }),
        ]);
    } else {
        await ctx.prisma.team_D4H.update({ where: { teamId }, data: { lastSyncedAt: now } });
    }

    // Organization_D4H cache refresh — org-bearing teams only.
    if (inputs.incomingOrgFields) {
        const orgKeys = [
            "orgName",
            "orgTimezone",
            "orgCurrency",
            "orgReportingStartDay",
            "orgReportingStartMonth",
        ] as const;
        const orgDiff = diffObject(
            Object.fromEntries(orgKeys.map((k) => [k, inputs.currentMeta[k] ?? null])),
            Object.fromEntries(orgKeys.map((k) => [k, inputs.incomingMeta[k] ?? null])),
        );
        if (orgDiff.length > 0) {
            await ctx.prisma.$transaction([
                ctx.prisma.organization_D4H.update({
                    where: { organizationId: ctx.organizationId },
                    data: { lastSyncedAt: now, ...inputs.incomingOrgFields },
                }),
                ctx.logEvent({
                    action: "Update",
                    objectType: "Organization",
                    objectId: ctx.organizationId,
                    description: "Refreshed cached D4H organisation attributes.",
                    changes: orgDiff,
                    batchId,
                }),
            ]);
        } else {
            await ctx.prisma.organization_D4H.update({
                where: { organizationId: ctx.organizationId },
                data: { lastSyncedAt: now },
            });
        }
    }
}

/**
 * Refresh the cached `Organization_D4H` attributes (name, timezone, currency,
 * reporting-year start) from D4H, bumping `lastSyncedAt`. Phase-1 org sync —
 * metadata only, no membership reconciliation (that stays per-team).
 *
 * Reaches the D4H organisation through the caller's personal token, using any
 * linked team as the API's `{context}/{contextId}`, so it requires at least one
 * `Team_D4H` and an org-linked (not org-less) `Organization_D4H`.
 */
export async function syncOrganizationD4HCache(
    ctx: AuthenticatedOrganizationContext,
): Promise<void> {
    const orgD4H = await ctx.prisma.organization_D4H.findUnique({
        where: { organizationId: ctx.organizationId },
    });
    if (!orgD4H) {
        throw new TRPCError({
            code: "BAD_REQUEST",
            message: "This organization is not linked to D4H.",
        });
    }
    if (orgD4H.d4hOrganisationId == null) {
        throw new TRPCError({
            code: "BAD_REQUEST",
            message: "This is an org-less D4H link — there is no D4H organisation to sync.",
        });
    }

    const anyLinkedTeam = await ctx.prisma.team_D4H.findFirst({
        where: { team: { organizationId: ctx.organizationId } },
        select: { d4hTeamId: true },
    });
    if (!anyLinkedTeam) {
        throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Link at least one team to D4H before syncing organisation details.",
        });
    }

    const token = await getPersonalD4HAccessTokenForUser(ctx.organizationId, ctx.userId);
    if (!token) {
        throw new TRPCError({
            code: "BAD_REQUEST",
            message: "No personal D4H Access Token found for user",
        });
    }

    const d4hOrg = await fetchD4HOrganisationCached(
        token,
        anyLinkedTeam.d4hTeamId,
        orgD4H.d4hOrganisationId,
    );

    const incoming = {
        d4hOrganisationName: d4hOrg.title,
        d4hTimezone: d4hOrg.timezone,
        d4hCurrency: d4hOrg.currency,
        d4hReportingStartDay: d4hOrg.reportingStartDay,
        d4hReportingStartMonth: d4hOrg.reportingStartMonth,
    };
    const changes = diffObject(
        {
            d4hOrganisationName: orgD4H.d4hOrganisationName,
            d4hTimezone: orgD4H.d4hTimezone,
            d4hCurrency: orgD4H.d4hCurrency,
            d4hReportingStartDay: orgD4H.d4hReportingStartDay,
            d4hReportingStartMonth: orgD4H.d4hReportingStartMonth,
        },
        incoming,
    );

    if (changes.length > 0) {
        await ctx.prisma.$transaction([
            ctx.prisma.organization_D4H.update({
                where: { organizationId: ctx.organizationId },
                data: { lastSyncedAt: new Date(), ...incoming },
            }),
            ctx.logEvent({
                action: "Update",
                objectType: "Organization",
                objectId: ctx.organizationId,
                description: "Refreshed cached D4H organisation attributes.",
                changes,
            }),
        ]);
    } else {
        await ctx.prisma.organization_D4H.update({
            where: { organizationId: ctx.organizationId },
            data: { lastSyncedAt: new Date() },
        });
    }
}

/**
 * Fetch → plan → (optionally match token) → apply. Used by link/create (no token
 * to match) and by `applyD4HTeamSync` (must match the previewed `planToken`).
 */
export async function runTeamSync(
    ctx: AuthenticatedOrganizationContext,
    args: {
        teamD4H: TeamD4HRecord;
        token: D4HAccessToken_ServerOnly;
        batchId: string;
        requireFreshMatch?: string;
    },
): Promise<{ plan: SyncPlan }> {
    const inputs = await fetchD4HSyncInputs(ctx, { teamD4H: args.teamD4H, token: args.token });
    const plan = planFromInputs(inputs);

    if (args.requireFreshMatch !== undefined && args.requireFreshMatch !== plan.planToken) {
        throw new TRPCError({ code: "CONFLICT", cause: new StalePlanError() });
    }

    await applyD4HSyncPlan(ctx, { plan, inputs, batchId: args.batchId });
    return { plan };
}
