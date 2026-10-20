/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 *  D4H linking & team synchronisation. See docs/specs/2026-09-10-d4h-linking.md and docs/plans/2026-09-10-d4h-linking.md.
 */

import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { diffObject } from "@/lib/diff";
import { ConflictError, NotFoundError, PreconditionError, ValidationError } from "@/lib/errors";
import { BatchUpdatePlanId } from "@/lib/schemas/batch-update-plan";
import { D4HAccessToken_ServerOnly } from "@/lib/schemas/d4h-access-token";
import {
    D4HSyncItem,
    D4HSyncItemDraft,
    D4HSyncItemOutcome,
    D4HSyncPlan,
    D4HSyncSkipReason,
    type D4HSyncChangedReason,
} from "@/lib/schemas/d4h-sync-plan";
import { D4HMember } from "@/lib/schemas/d4h/member";
import { PersonId } from "@/lib/schemas/person";
import { TeamId, type TeamD4HRecord } from "@/lib/schemas/team";
import { TeamMembershipId } from "@/lib/schemas/team-membership";
import { getConfiguredD4HAccessToken, toD4HCredentialRef } from "@/server/d4h-access-token";
import {
    fetchD4HOrganisationCached,
    fetchD4HTeamDetailCached,
    fetchD4HTeamMembersForSync,
    getD4HTokenMetadata,
} from "@/server/d4h-api/client";
import { D4HLinkAction } from "@/server/d4h-link-invariants";
import * as BatchUpdatePlans from "@/server/services/batch-update-plans";
import * as Personnel from "@/server/services/personnel";

import type { OrgServiceContext } from "./service-context";
import { withBatch } from "./service-context";

const personTeamRefs = (personId: string, teamId: string) => [
    { objectType: "Person" as const, objectId: personId, role: "context" as const },
    { objectType: "Team" as const, objectId: teamId, role: "context" as const },
];

//
// Pure, deterministic builder for the persisted plan (`D4HSyncPlan`, the payload of a
// `d4h-team-sync` `BatchUpdatePlan`) — no Prisma, no D4H API. Unit-tested directly
// (`d4h-team-sync.test.ts`). See docs/specs/2026-09-10-d4h-linking.md §7 and
// docs/plans/2026-10-19-d4h-sync-plans.md, "Plan builder rules".
//

/** The `TeamMembership_D4H` snapshot fields, in the shape `diffObject` compares. */
export type D4HMembershipSnapshot = {
    d4hStatus: string;
    d4hPosition: string | null;
    d4hRef: string | null;
    d4hRoleId: number | null;
};

export function snapshotFromD4HMember(member: D4HMember): D4HMembershipSnapshot {
    return {
        d4hStatus: member.status,
        d4hPosition: member.position,
        d4hRef: member.ref,
        d4hRoleId: member.role.id,
    };
}

type D4HSyncMetadataItem = Extract<D4HSyncItem, { kind: "metadata" }>;

/** One membership of the team, D4H-linked or manual, in any status. */
export type D4HSyncTeamMembershipInput = {
    teamMembershipId: string;
    personId: string;
    personName: string;
    personEmail: string;
    status: "Active" | "Archived" | "Deleted";
    /** The `TeamMembership_D4H` row; null for a manual membership. */
    d4h: (D4HMembershipSnapshot & { d4hMemberId: number }) | null;
};

export type BuildD4HSyncPlanInput = {
    d4hTeamId: number;
    /** D4H members already filtered to OPERATIONAL + NON_OPERATIONAL. */
    d4hMembers: D4HMember[];
    /** Every membership of this team: linked and manual, `Deleted` ones included. */
    teamMemberships: D4HSyncTeamMembershipInput[];
    /** Normalised (trimmed, lowercased) emails of people in the org that aren't `Deleted`. */
    existingPersonEmails: ReadonlySet<string>;
    /** Normalised emails of `Deleted` people (#183). */
    deletedPersonEmails: ReadonlySet<string>;
    /** The stored and incoming `Team_D4H` fields, and `Organization_D4H` for an org-bearing team. */
    metadata: Pick<D4HSyncMetadataItem, "team" | "organization">;
};

export function normaliseD4HEmail(email: string): string {
    return email.trim().toLowerCase();
}

function snapshotOf(d4h: D4HMembershipSnapshot): D4HMembershipSnapshot {
    return {
        d4hStatus: d4h.d4hStatus,
        d4hPosition: d4h.d4hPosition,
        d4hRef: d4h.d4hRef,
        d4hRoleId: d4h.d4hRoleId,
    };
}

/** The flat shape the metadata diff is shown in: team fields, then org fields keyed `org…`. */
function flatMetadata(
    team: D4HSyncMetadataItem["team"]["before"],
    org: NonNullable<D4HSyncMetadataItem["organization"]>["before"] | null,
): Record<string, string | number | null> {
    return {
        d4hTeamName: team.d4hTeamName,
        d4hOrganisationId: team.d4hOrganisationId,
        d4hTimezone: team.d4hTimezone,
        ...(org
            ? {
                  orgName: org.d4hOrganisationName,
                  orgTimezone: org.d4hTimezone,
                  orgCurrency: org.d4hCurrency,
                  orgReportingStartDay: org.d4hReportingStartDay,
                  orgReportingStartMonth: org.d4hReportingStartMonth,
              }
            : {}),
    };
}

/**
 * Reconcile the D4H team against this team's memberships. A D4H member matched to a non-`Deleted`
 * linked membership by `d4hMemberId` is updated or reactivated. Any other member is checked in
 * this order, the first match winning:
 *
 * 1. blank email → skipped `missing-email`
 * 2. a `Deleted` membership on this team is linked to the member's `d4hMemberId` → skipped
 *    `membership-in-rubbish-bin` (as an add it would fail `already-linked` on every sync)
 * 3. email shared with another D4H member → skipped `duplicate-email` (#144)
 * 4. email of a `Deleted` person → skipped `person-in-rubbish-bin` (#183)
 * 5. the person's membership on this team is `Deleted` → skipped `membership-in-rubbish-bin`
 * 6. the person's membership is linked to a D4H member who is gone → `relink`
 * 7. the person's membership is linked to another D4H member who is still in D4H → skipped
 *    `linked-to-another-member`
 * 8. otherwise → `add`
 *
 * An `Active` linked membership whose member is gone, and that isn't relinked, is archived.
 */
export function buildD4HSyncPlan(input: BuildD4HSyncPlanInput): D4HSyncPlan {
    const linked = input.teamMemberships.flatMap((m) =>
        m.d4h !== null && m.status !== "Deleted" ? [{ ...m, d4h: m.d4h, status: m.status }] : [],
    );
    const linkedByMemberId = new Map(linked.map((m) => [m.d4h.d4hMemberId, m]));
    const binnedMemberIds = new Set(
        input.teamMemberships.flatMap((m) =>
            m.d4h !== null && m.status === "Deleted" ? [m.d4h.d4hMemberId] : [],
        ),
    );
    // A person has at most one membership per team, so an email picks at most one.
    const membershipByEmail = new Map(
        input.teamMemberships.map((m) => [normaliseD4HEmail(m.personEmail), m]),
    );
    const d4hMemberIds = new Set(input.d4hMembers.map((m) => m.id));

    const emailCounts = new Map<string, number>();
    for (const member of input.d4hMembers) {
        const email = normaliseD4HEmail(member.email.value);
        if (email) emailCounts.set(email, (emailCounts.get(email) ?? 0) + 1);
    }

    type Draft<K extends D4HSyncItemDraft["kind"]> = Extract<D4HSyncItemDraft, { kind: K }>;
    const additions: Draft<"add">[] = [];
    const relinks: Draft<"relink">[] = [];
    const updates: Draft<"update">[] = [];
    const reactivations: Draft<"reactivate">[] = [];
    const archivals: Draft<"archive">[] = [];
    const skipped: D4HSyncPlan["skipped"] = [];
    const relinkedMembershipIds = new Set<string>();

    const skip = (member: D4HMember, reason: D4HSyncSkipReason) =>
        skipped.push({ d4hMemberId: member.id, name: member.name, reason });

    for (const member of input.d4hMembers) {
        const incoming = snapshotFromD4HMember(member);
        const matched = linkedByMemberId.get(member.id);

        if (matched) {
            const before = snapshotOf(matched.d4h);
            const changes = diffObject(before, incoming);
            const common = {
                teamMembershipId: matched.teamMembershipId,
                personId: matched.personId,
                personName: matched.personName,
                d4hMemberId: member.id,
                incoming,
                changes,
            };
            if (matched.status === "Archived") {
                reactivations.push({
                    kind: "reactivate",
                    itemId: `reactivate:${matched.teamMembershipId}`,
                    ...common,
                });
            } else if (changes.length > 0) {
                updates.push({
                    kind: "update",
                    itemId: `update:${matched.teamMembershipId}`,
                    before,
                    ...common,
                });
            }
            continue;
        }

        const email = normaliseD4HEmail(member.email.value);
        if (!email) {
            skip(member, "missing-email");
            continue;
        }
        if (binnedMemberIds.has(member.id)) {
            skip(member, "membership-in-rubbish-bin");
            continue;
        }
        if ((emailCounts.get(email) ?? 0) > 1) {
            skip(member, "duplicate-email");
            continue;
        }
        if (input.deletedPersonEmails.has(email)) {
            skip(member, "person-in-rubbish-bin");
            continue;
        }

        const membership = membershipByEmail.get(email);
        if (membership?.status === "Deleted") {
            skip(member, "membership-in-rubbish-bin");
            continue;
        }

        if (membership && membership.d4h && !d4hMemberIds.has(membership.d4h.d4hMemberId)) {
            const before = snapshotOf(membership.d4h);
            relinks.push({
                kind: "relink",
                itemId: `relink:${membership.teamMembershipId}`,
                teamMembershipId: membership.teamMembershipId,
                personId: membership.personId,
                personName: membership.personName,
                previousD4hMemberId: membership.d4h.d4hMemberId,
                d4hMemberId: member.id,
                membershipStatus: membership.status,
                before,
                incoming,
                changes: diffObject(before, incoming),
            });
            relinkedMembershipIds.add(membership.teamMembershipId);
            continue;
        }

        if (membership?.d4h) {
            // Linked to a different D4H member who is still in D4H: neither a relink nor an add.
            skip(member, "linked-to-another-member");
            continue;
        }

        additions.push({
            kind: "add",
            itemId: `add:${member.id}`,
            d4hMemberId: member.id,
            personName: member.name,
            email: member.email.value.trim(),
            incoming,
            personMatch: input.existingPersonEmails.has(email) ? "existing" : "new",
            // Any membership left here is a non-`Deleted` manual one.
            adoptsMembership: membership !== undefined,
        });
    }

    for (const membership of linked) {
        if (membership.status !== "Active") continue;
        if (d4hMemberIds.has(membership.d4h.d4hMemberId)) continue;
        if (relinkedMembershipIds.has(membership.teamMembershipId)) continue;
        archivals.push({
            kind: "archive",
            itemId: `archive:${membership.teamMembershipId}`,
            teamMembershipId: membership.teamMembershipId,
            personId: membership.personId,
            personName: membership.personName,
            d4hMemberId: membership.d4h.d4hMemberId,
        });
    }

    const byNameThenItemId = (a: { personName: string; itemId: string }, b: typeof a) =>
        a.personName.localeCompare(b.personName) || a.itemId.localeCompare(b.itemId);
    for (const list of [additions, relinks, updates, reactivations, archivals]) {
        list.sort(byNameThenItemId);
    }
    skipped.sort((a, b) => a.name.localeCompare(b.name) || a.d4hMemberId - b.d4hMemberId);

    const { team, organization } = input.metadata;
    const metadata: Draft<"metadata"> = {
        kind: "metadata",
        itemId: "metadata",
        team,
        organization,
        changes: diffObject(
            flatMetadata(team.before, organization?.before ?? null),
            flatMetadata(team.incoming, organization?.incoming ?? null),
        ),
    };

    return D4HSyncPlan.schema.parse({
        d4hTeamId: input.d4hTeamId,
        items: [...additions, ...relinks, ...updates, ...reactivations, ...archivals, metadata],
        skipped,
        counts: {
            additions: additions.length,
            relinks: relinks.length,
            updates: updates.length,
            reactivations: reactivations.length,
            archivals: archivals.length,
            skipped: skipped.length,
        },
    });
}

//
// Orchestration — resolves D4H teams and writes the org-level D4H link and cache.
//

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
    ctx: OrgServiceContext,
    d4hTeamId: number,
): Promise<ResolvedD4HTeam> {
    const token = await getConfiguredD4HAccessToken(ctx.organizationId, ctx.userId);

    const { d4HTeams } = await getD4HTokenMetadata(toD4HCredentialRef(token));
    const ref = d4HTeams.find((t) => t.id === d4hTeamId);
    if (!ref) {
        throw new NotFoundError(
            `D4H Team ${d4hTeamId} not found or not accessible with your token.`,
        );
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
    ctx: OrgServiceContext,
    args: { action: D4HLinkAction; resolved: ResolvedD4HTeam; batchId: string },
): Promise<void> {
    const { action, resolved, batchId } = args;
    if (action.kind === "reuse") return;

    // Two concurrent first-time links race on the unique `organizationId` — surface
    // the loser as a friendly conflict rather than a raw Prisma P2002 / opaque 500.
    const createOrgLink = async (writes: Prisma.PrismaPromise<unknown>[]) => {
        try {
            await ctx.prisma.$transaction(writes);
        } catch (e) {
            if (e instanceof Object && "code" in e && e.code === "P2002") {
                throw new ConflictError(
                    "This organisation was just linked to D4H — reload the page and try again.",
                );
            }
            throw e;
        }
    };

    if (action.kind === "create-org-linked") {
        const d4hOrg = await fetchD4HOrganisationCached(
            toD4HCredentialRef(resolved.token),
            resolved.d4hTeamId,
            action.d4hOrganisationId,
        );
        await createOrgLink([
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
    await createOrgLink([
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

/**
 * Refresh the cached `Organization_D4H` attributes (name, timezone, currency,
 * reporting-year start) from D4H, bumping `lastSyncedAt`. Phase-1 org sync —
 * metadata only, no membership reconciliation (that stays per-team).
 *
 * Reaches the D4H organisation through the caller's personal token, using any
 * linked team as the API's `{context}/{contextId}`, so it requires at least one
 * `Team_D4H` and an org-linked (not org-less) `Organization_D4H`.
 */
export async function syncOrganizationD4HCache(ctx: OrgServiceContext): Promise<void> {
    const orgD4H = await ctx.prisma.organization_D4H.findUnique({
        where: { organizationId: ctx.organizationId },
    });
    if (!orgD4H) {
        throw new ValidationError("This organisation is not linked to D4H.");
    }
    if (orgD4H.d4hOrganisationId == null) {
        throw new ValidationError(
            "This is an org-less D4H link — there is no D4H organisation to sync.",
        );
    }

    const anyLinkedTeam = await ctx.prisma.team_D4H.findFirst({
        where: { team: { organizationId: ctx.organizationId } },
        select: { d4hTeamId: true },
    });
    if (!anyLinkedTeam) {
        throw new PreconditionError(
            "Link at least one team to D4H before syncing organisation details.",
        );
    }

    const token = await getConfiguredD4HAccessToken(ctx.organizationId, ctx.userId);

    const d4hOrg = await fetchD4HOrganisationCached(
        toD4HCredentialRef(token),
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
        await ctx.prisma.$transaction([
            ctx.prisma.organization_D4H.update({
                where: { organizationId: ctx.organizationId },
                data: { lastSyncedAt: new Date() },
            }),
            ctx.logEvent({
                action: "Update",
                objectType: "Organization",
                objectId: ctx.organizationId,
                description: "Synced cached D4H organisation attributes — no changes.",
            }),
        ]);
    }
}

//
// Executing a persisted plan (`D4HSyncPlan`, the payload of a `d4h-team-sync` `BatchUpdatePlan`).
// See docs/plans/2026-10-19-d4h-sync-plans.md, "The D4H payload and executor".
//

export const D4H_TEAM_SYNC_KIND = "d4h-team-sync";

/** `PlanAlreadyRunningError`'s message, phrased for a team. */
const ALREADY_SYNCING = "A sync of this team is already running.";

type AddItem = Extract<D4HSyncItem, { kind: "add" }>;
type UpdateItem = Extract<D4HSyncItem, { kind: "update" }>;
type ReactivateItem = Extract<D4HSyncItem, { kind: "reactivate" }>;
type ArchiveItem = Extract<D4HSyncItem, { kind: "archive" }>;
type RelinkItem = Extract<D4HSyncItem, { kind: "relink" }>;

/** The order items run in, whatever order the payload lists them in. */
const EXECUTION_ORDER: readonly D4HSyncItem["kind"][] = [
    "add",
    "relink",
    "update",
    "reactivate",
    "archive",
    "metadata",
];

/** An item's outcome without its `itemId`, which the loop adds. */
type ItemResult = Omit<D4HSyncItemOutcome, "itemId">;

const applied: ItemResult = { result: "applied" };
const changed = (reason: D4HSyncChangedReason): ItemResult => ({
    result: "skipped-changed",
    reason,
});

function hasPrismaCode(e: unknown, code: string): boolean {
    return e instanceof Object && "code" in e && e.code === code;
}

const isUniqueViolation = (e: unknown) => hasPrismaCode(e, "P2002");

/**
 * Run an item's write, whose `where` repeats the precondition the item just checked, so a change
 * between the check and the write makes the update match nothing (P2025) rather than overwrite
 * it. The write's `logEvent` shares its transaction and rolls back with it. On P2025, the
 * precondition is checked again for the reason, falling back to `fallback`.
 */
async function writeUnlessChanged(
    write: () => Promise<unknown>,
    recheck: () => Promise<ItemResult | null>,
    fallback: D4HSyncChangedReason,
): Promise<ItemResult> {
    try {
        await write();
        return applied;
    } catch (e) {
        if (!hasPrismaCode(e, "P2025")) throw e;
        return (await recheck()) ?? changed(fallback);
    }
}

/** The result of checking an item's precondition: the membership to write, or why not to. */
type Checked<M> = { refused: ItemResult } | { membership: M };

function sameSnapshot(a: D4HMembershipSnapshot, b: D4HMembershipSnapshot): boolean {
    return (
        a.d4hStatus === b.d4hStatus &&
        a.d4hPosition === b.d4hPosition &&
        a.d4hRef === b.d4hRef &&
        a.d4hRoleId === b.d4hRoleId
    );
}

/** Whether any membership of this team, in any status, is linked to `d4hMemberId`. */
async function isLinkedOnTeam(
    ctx: OrgServiceContext,
    teamId: string,
    d4hMemberId: number,
): Promise<boolean> {
    const row = await ctx.prisma.teamMembership_D4H.findFirst({
        where: { d4hMemberId, teamMembership: { teamId, organizationId: ctx.organizationId } },
        select: { teamMembershipId: true },
    });
    return row !== null;
}

/** A membership of this team with its D4H link, or null if it no longer exists. */
function findTeamMembership(ctx: OrgServiceContext, teamId: string, teamMembershipId: string) {
    return ctx.prisma.teamMembership.findFirst({
        where: { id: teamMembershipId, teamId, organizationId: ctx.organizationId },
        select: { id: true, status: true, d4h: true },
    });
}

type TeamMembershipRow = NonNullable<Awaited<ReturnType<typeof findTeamMembership>>>;
/** A membership that passed a precondition requiring its D4H link. */
type LinkedMembership = TeamMembershipRow & { d4h: NonNullable<TeamMembershipRow["d4h"]> };

async function executeAdd(
    ctx: OrgServiceContext,
    teamId: string,
    item: AddItem,
): Promise<ItemResult> {
    if (await isLinkedOnTeam(ctx, teamId, item.d4hMemberId)) return changed("already-linked");

    let person = await Personnel.getByEmail(ctx, item.email);
    if (person?.status === "Deleted") return changed("person-in-rubbish-bin");
    if (!person) {
        person = (
            await Personnel.create(ctx, PersonId.create(), {
                name: item.personName,
                email: item.email,
                tags: [],
                properties: {},
            })
        ).created;
    }
    const personId = person.id;

    const membershipOfPerson = () =>
        ctx.prisma.teamMembership.findUnique({
            where: { teamId_personId: { teamId, personId } },
            select: { id: true, status: true, d4h: { select: { d4hMemberId: true } } },
        });

    type Existing = NonNullable<Awaited<ReturnType<typeof membershipOfPerson>>>;
    const refuseTakeOver = (existing: Existing | null): ItemResult | null => {
        if (!existing) return changed("membership-missing");
        if (existing.status === "Deleted") return changed("membership-in-rubbish-bin");
        if (existing.d4h) return changed("linked-to-another-member");
        return null;
    };

    /** Take over the person's existing membership on this team, if it's a live manual one. */
    const takeOver = async (existing: Existing): Promise<ItemResult> => {
        const refused = refuseTakeOver(existing);
        if (refused) return refused;
        return writeUnlessChanged(
            () =>
                ctx.prisma.$transaction([
                    ctx.prisma.teamMembership.update({
                        where: { id: existing.id, status: { not: "Deleted" }, d4h: { is: null } },
                        data: {
                            status: "Active",
                            d4h: { create: { d4hMemberId: item.d4hMemberId, ...item.incoming } },
                        },
                    }),
                    ctx.logEvent({
                        action: "Update",
                        objectType: "TeamMembership",
                        objectId: existing.id,
                        description: "Adopted a manual membership as D4H-managed.",
                        changes: diffObject({ status: existing.status }, { status: "Active" }),
                        refs: personTeamRefs(personId, teamId),
                    }),
                ]),
            async () => refuseTakeOver(await membershipOfPerson()),
            "membership-missing",
        );
    };

    const existing = await membershipOfPerson();
    if (existing) return takeOver(existing);

    const teamMembershipId = TeamMembershipId.create();
    try {
        await ctx.prisma.$transaction([
            ctx.prisma.teamMembership.create({
                data: {
                    id: teamMembershipId,
                    organizationId: ctx.organizationId,
                    teamId,
                    personId,
                    status: "Active",
                    d4h: { create: { d4hMemberId: item.d4hMemberId, ...item.incoming } },
                },
            }),
            ctx.logEvent({
                action: "Create",
                objectType: "TeamMembership",
                objectId: teamMembershipId,
                description: "Added from linked D4H team.",
                refs: personTeamRefs(personId, teamId),
            }),
        ]);
        return applied;
    } catch (e) {
        // Lost a race with a concurrent manual add that created this membership between the
        // lookup above and this create: take over the row it created instead.
        if (!isUniqueViolation(e)) throw e;
        const raced = await membershipOfPerson();
        if (!raced) throw e;
        return takeOver(raced);
    }
}

async function executeRelink(
    ctx: OrgServiceContext,
    teamId: string,
    item: RelinkItem,
): Promise<ItemResult> {
    const check = async (): Promise<Checked<LinkedMembership>> => {
        const membership = await findTeamMembership(ctx, teamId, item.teamMembershipId);
        if (!membership) return { refused: changed("membership-missing") };
        if (membership.status === "Deleted") {
            return { refused: changed("membership-in-rubbish-bin") };
        }
        if (membership.d4h?.d4hMemberId !== item.previousD4hMemberId) {
            return { refused: changed("d4h-member-changed") };
        }
        if (await isLinkedOnTeam(ctx, teamId, item.d4hMemberId)) {
            return { refused: changed("already-linked") };
        }
        return { membership: { ...membership, d4h: membership.d4h } };
    };
    const checked = await check();
    if ("refused" in checked) return checked.refused;
    const { membership } = checked;

    const reactivates = membership.status === "Archived";
    return writeUnlessChanged(
        () =>
            ctx.prisma.$transaction([
                ctx.prisma.teamMembership.update({
                    where: {
                        id: membership.id,
                        status: { not: "Deleted" },
                        d4h: { is: { d4hMemberId: item.previousD4hMemberId } },
                    },
                    data: {
                        ...(reactivates ? { status: "Active" as const } : {}),
                        d4h: { update: { d4hMemberId: item.d4hMemberId, ...item.incoming } },
                    },
                }),
                ctx.logEvent({
                    action: "Update",
                    objectType: "TeamMembership",
                    objectId: membership.id,
                    description: "Re-linked to a new D4H member with the same email.",
                    changes: [
                        ...diffObject(
                            { d4hMemberId: item.previousD4hMemberId },
                            { d4hMemberId: item.d4hMemberId },
                        ),
                        ...(reactivates
                            ? diffObject({ status: "Archived" }, { status: "Active" })
                            : []),
                        ...diffObject(snapshotOf(membership.d4h), item.incoming),
                    ],
                    refs: personTeamRefs(item.personId, teamId),
                }),
            ]),
        async () => {
            const rechecked = await check();
            return "refused" in rechecked ? rechecked.refused : null;
        },
        "d4h-member-changed",
    );
}

async function executeUpdate(
    ctx: OrgServiceContext,
    teamId: string,
    item: UpdateItem,
): Promise<ItemResult> {
    const check = async (): Promise<Checked<LinkedMembership>> => {
        const membership = await findTeamMembership(ctx, teamId, item.teamMembershipId);
        if (!membership) return { refused: changed("membership-missing") };
        if (membership.status === "Deleted") {
            return { refused: changed("membership-in-rubbish-bin") };
        }
        if (membership.d4h?.d4hMemberId !== item.d4hMemberId) {
            return { refused: changed("d4h-member-changed") };
        }
        if (!sameSnapshot(membership.d4h, item.before)) {
            return { refused: changed("details-changed") };
        }
        return { membership: { ...membership, d4h: membership.d4h } };
    };
    const checked = await check();
    if ("refused" in checked) return checked.refused;
    const { membership } = checked;

    return writeUnlessChanged(
        () =>
            ctx.prisma.$transaction([
                ctx.prisma.teamMembership.update({
                    where: {
                        id: membership.id,
                        status: { not: "Deleted" },
                        d4h: { is: { d4hMemberId: item.d4hMemberId, ...item.before } },
                    },
                    data: { d4h: { update: item.incoming } },
                }),
                ctx.logEvent({
                    action: "Update",
                    objectType: "TeamMembership",
                    objectId: membership.id,
                    changes: item.changes,
                    refs: personTeamRefs(item.personId, teamId),
                }),
            ]),
        async () => {
            const rechecked = await check();
            return "refused" in rechecked ? rechecked.refused : null;
        },
        "details-changed",
    );
}

async function executeReactivate(
    ctx: OrgServiceContext,
    teamId: string,
    item: ReactivateItem,
): Promise<ItemResult> {
    const check = async (): Promise<Checked<LinkedMembership>> => {
        const membership = await findTeamMembership(ctx, teamId, item.teamMembershipId);
        if (!membership) return { refused: changed("membership-missing") };
        if (membership.status !== "Archived") return { refused: changed("not-archived") };
        if (membership.d4h?.d4hMemberId !== item.d4hMemberId) {
            return { refused: changed("d4h-member-changed") };
        }
        return { membership: { ...membership, d4h: membership.d4h } };
    };
    const checked = await check();
    if ("refused" in checked) return checked.refused;
    const { membership } = checked;

    return writeUnlessChanged(
        () =>
            ctx.prisma.$transaction([
                ctx.prisma.teamMembership.update({
                    where: {
                        id: membership.id,
                        status: "Archived",
                        d4h: { is: { d4hMemberId: item.d4hMemberId } },
                    },
                    data: { status: "Active", d4h: { update: item.incoming } },
                }),
                ctx.logEvent({
                    action: "Update",
                    objectType: "TeamMembership",
                    objectId: membership.id,
                    description: "Reactivated — member is back in the linked D4H team.",
                    changes: [
                        ...diffObject({ status: "Archived" }, { status: "Active" }),
                        ...diffObject(snapshotOf(membership.d4h), item.incoming),
                    ],
                    refs: personTeamRefs(item.personId, teamId),
                }),
            ]),
        async () => {
            const rechecked = await check();
            return "refused" in rechecked ? rechecked.refused : null;
        },
        "not-archived",
    );
}

async function executeArchive(
    ctx: OrgServiceContext,
    teamId: string,
    item: ArchiveItem,
): Promise<ItemResult> {
    const check = async (): Promise<ItemResult | null> => {
        const membership = await findTeamMembership(ctx, teamId, item.teamMembershipId);
        if (!membership) return changed("membership-missing");
        if (membership.status !== "Active") return changed("not-active");
        if (membership.d4h?.d4hMemberId !== item.d4hMemberId) return changed("d4h-member-changed");
        return null;
    };
    const refused = await check();
    if (refused) return refused;

    return writeUnlessChanged(
        () =>
            ctx.prisma.$transaction([
                ctx.prisma.teamMembership.update({
                    where: {
                        id: item.teamMembershipId,
                        status: "Active",
                        d4h: { is: { d4hMemberId: item.d4hMemberId } },
                    },
                    data: { status: "Archived" },
                }),
                ctx.logEvent({
                    action: "Update",
                    objectType: "TeamMembership",
                    objectId: item.teamMembershipId,
                    description: "Archived — member is no longer in the linked D4H team.",
                    changes: diffObject({ status: "Active" }, { status: "Archived" }),
                    refs: personTeamRefs(item.personId, teamId),
                }),
            ]),
        check,
        "not-active",
    );
}

type FieldValue = string | number | null;

/**
 * Gate one cache row's fields on the plan's `before`: of the fields the plan changes, write those
 * whose current value still equals `before`, and report the others by their display key. A missing
 * row reports every field the plan changes. `writeKeys` are the display keys of the fields written.
 */
function gateFields<T extends Record<string, FieldValue>>(
    displayKeys: NoInfer<{ [K in keyof T]: string }>,
    before: T,
    incoming: NoInfer<T>,
    current: NoInfer<T> | null,
) {
    const write: Partial<T> = {};
    const writeBefore: Partial<T> = {};
    const writeKeys: string[] = [];
    const skippedFields: string[] = [];
    for (const key of Object.keys(displayKeys) as (keyof T)[]) {
        if (incoming[key] === before[key]) continue;
        if (current === null || current[key] !== before[key]) {
            skippedFields.push(displayKeys[key]);
            continue;
        }
        write[key] = incoming[key];
        writeBefore[key] = before[key];
        writeKeys.push(displayKeys[key]);
    }
    return { write, writeBefore, writeKeys, skippedFields };
}

/** Each cache field, mapped to its key in the metadata item's flat display diff. */
const TEAM_FIELD_KEYS = {
    d4hTeamName: "d4hTeamName",
    d4hOrganisationId: "d4hOrganisationId",
    d4hTimezone: "d4hTimezone",
} as const;
const ORG_FIELD_KEYS = {
    d4hOrganisationName: "orgName",
    d4hTimezone: "orgTimezone",
    d4hCurrency: "orgCurrency",
    d4hReportingStartDay: "orgReportingStartDay",
    d4hReportingStartMonth: "orgReportingStartMonth",
} as const;

/**
 * Each part's write repeats its `before` values in its `where`, so a field edited between the
 * check and the write makes that part's update match nothing: it then writes and logs nothing,
 * and reports its fields as changed. Both parts share one transaction.
 */
async function executeMetadata(
    ctx: OrgServiceContext,
    teamId: string,
    item: D4HSyncMetadataItem,
): Promise<ItemResult> {
    const [teamRow, orgRow] = await Promise.all([
        ctx.prisma.team_D4H.findUnique({ where: { teamId } }),
        item.organization
            ? ctx.prisma.organization_D4H.findUnique({
                  where: { organizationId: ctx.organizationId },
              })
            : null,
    ]);

    const team = gateFields(TEAM_FIELD_KEYS, item.team.before, item.team.incoming, teamRow);
    const org = item.organization
        ? gateFields(ORG_FIELD_KEYS, item.organization.before, item.organization.incoming, orgRow)
        : null;
    const teamWrites = team.writeKeys.length > 0;
    const orgWrites = org !== null && org.writeKeys.length > 0;

    const { wrote, lostFields } =
        teamWrites || orgWrites
            ? await ctx.prisma.$transaction(async (tx) => {
                  let wrote = false;
                  const lostFields: string[] = [];
                  if (teamWrites) {
                      const { count } = await tx.team_D4H.updateMany({
                          where: { teamId, ...team.writeBefore },
                          data: team.write,
                      });
                      if (count > 0) {
                          wrote = true;
                          await ctx.logEvent(
                              {
                                  action: "Update",
                                  objectType: "Team",
                                  objectId: teamId,
                                  description: "Refreshed D4H team metadata.",
                                  changes: diffObject(team.writeBefore, team.write),
                              },
                              tx,
                          );
                      } else {
                          lostFields.push(...team.writeKeys);
                      }
                  }
                  if (org && orgWrites) {
                      const { count } = await tx.organization_D4H.updateMany({
                          where: { organizationId: ctx.organizationId, ...org.writeBefore },
                          data: org.write,
                      });
                      if (count > 0) {
                          wrote = true;
                          await ctx.logEvent(
                              {
                                  action: "Update",
                                  objectType: "Organization",
                                  objectId: ctx.organizationId,
                                  description: "Refreshed cached D4H organisation attributes.",
                                  changes: diffObject(org.writeBefore, org.write),
                              },
                              tx,
                          );
                      } else {
                          lostFields.push(...org.writeKeys);
                      }
                  }
                  return { wrote, lostFields };
              })
            : { wrote: false, lostFields: [] };

    const skippedFields = [...team.skippedFields, ...(org?.skippedFields ?? []), ...lostFields];
    if (!wrote && skippedFields.length > 0) {
        return { result: "skipped-changed", reason: "fields-changed", skippedFields };
    }
    return skippedFields.length > 0 ? { result: "applied", skippedFields } : applied;
}

function executeItem(ctx: OrgServiceContext, teamId: string, item: D4HSyncItem) {
    switch (item.kind) {
        case "add":
            return executeAdd(ctx, teamId, item);
        case "relink":
            return executeRelink(ctx, teamId, item);
        case "update":
            return executeUpdate(ctx, teamId, item);
        case "reactivate":
            return executeReactivate(ctx, teamId, item);
        case "archive":
            return executeArchive(ctx, teamId, item);
        case "metadata":
            return executeMetadata(ctx, teamId, item);
    }
}

/**
 * Execute a persisted D4H sync plan item by item, from the stored payload: no D4H token and no D4H
 * fetch. Each item checks its precondition at execute time and records an outcome (`applied`,
 * `skipped-by-user`, or `skipped-changed` with a reason) rather than failing the plan. Items run in
 * the order add, relink, update, reactivate, archive, metadata, each committing its write together
 * with its `logEvent`, joined to the run's `LogBatch`.
 *
 * The batch comes from `openBatch`, called only once the guards have passed and the plan is
 * claimed, so a refused execute leaves no empty batch behind. It's given the team, for the batch's
 * description.
 *
 * On success the plan is `Completed`, and `Team_D4H.lastSyncedAt` (and `Organization_D4H`'s, for
 * an org-bearing team, unless it's already later) is set to the plan's `createdAt`, the time of
 * the snapshot. When the metadata item wrote no fields, a Team entry records the sync, so the
 * batch is never empty. If an item throws, or the team's link to the plan's D4H team is gone by
 * the end, the plan is `Failed` with the outcomes so far, `lastSyncedAt` is left alone, and the
 * error is rethrown.
 *
 * @throws NotFoundError if the plan does not exist within the organization.
 * @throws PlanAlreadyRunningError if another sync of the team is running.
 * @throws ConflictError if the plan isn't a D4H team sync, its team is no longer active or no
 *   longer linked to the plan's D4H team (before the run, or by its end), or the plan can't be
 *   claimed (already run, superseded, or expired).
 */
export async function executeD4HSyncPlan(
    ctx: OrgServiceContext,
    args: {
        planId: BatchUpdatePlanId;
        skipItemIds: readonly string[];
        openBatch: (team: { id: TeamId; name: string }) => Promise<string>;
    },
): Promise<{
    plan: { id: BatchUpdatePlanId; teamId: TeamId; payload: D4HSyncPlan };
    outcomes: D4HSyncItemOutcome[];
}> {
    const { planId } = args;
    const row = await BatchUpdatePlans.requireById(ctx, planId);

    // Guards, before the payload is parsed or the plan claimed.
    if (row.kind !== D4H_TEAM_SYNC_KIND || row.targetType !== "Team") {
        throw new ConflictError("This plan isn't a D4H team sync.");
    }
    const team = await ctx.prisma.team.findFirst({
        where: { id: row.targetId, organizationId: ctx.organizationId },
        include: { d4h: true },
    });
    if (!team || team.status !== "Active") {
        throw new ConflictError("The team is no longer active, so this sync can't be applied.");
    }
    const stored = D4HSyncPlan.schema.pick({ d4hTeamId: true }).safeParse(row.payload);
    if (!team.d4h || !stored.success || stored.data.d4hTeamId !== team.d4h.d4hTeamId) {
        throw new ConflictError(
            "The team is no longer linked to this preview's D4H team. Refresh it and try again.",
        );
    }
    const teamId = TeamId.schema.parse(team.id);

    try {
        await BatchUpdatePlans.claim(ctx, planId, new Date());
    } catch (e) {
        if (e instanceof BatchUpdatePlans.PlanAlreadyRunningError) {
            throw new BatchUpdatePlans.PlanAlreadyRunningError(ALREADY_SYNCING);
        }
        throw e;
    }

    const skip = new Set(args.skipItemIds);
    const outcomes: D4HSyncItemOutcome[] = [];
    let batchId: string | null = null;

    try {
        batchId = await args.openBatch({ id: teamId, name: team.name });
        const ctxBatch = withBatch(ctx, batchId);
        const payload = D4HSyncPlan.schema.parse(row.payload);
        const items = EXECUTION_ORDER.flatMap((kind) =>
            payload.items.filter((item) => item.kind === kind),
        );

        for (const item of items) {
            const result: ItemResult = skip.has(item.itemId)
                ? { result: "skipped-by-user" }
                : await executeItem(ctxBatch, teamId, item);
            outcomes.push({ itemId: item.itemId, ...result });
        }

        // AVUT reflects D4H as of the plan's snapshot. `lastSyncedAt` is bookkeeping, not
        // audited, but a sync whose metadata item wrote nothing still gets an entry in its batch.
        const metadataItem = payload.items.find((item) => item.kind === "metadata");
        const metadataWrote =
            metadataItem !== undefined &&
            metadataItem.changes.length > 0 &&
            outcomes.some((o) => o.itemId === metadataItem.itemId && o.result === "applied");

        // The team may have been unlinked (and perhaps relinked) while the items ran: don't mark
        // a different link as synced. The write's `where` repeats the check, so a change between
        // the two matches nothing (P2025) and rolls the completion back.
        const linkChanged = () =>
            new ConflictError(
                "The team's D4H link changed while this sync ran, so it wasn't marked as synced.",
            );
        const link = await ctx.prisma.team_D4H.findUnique({
            where: { teamId },
            select: { d4hTeamId: true },
        });
        if (link?.d4hTeamId !== payload.d4hTeamId) throw linkChanged();
        try {
            await ctx.prisma.$transaction([
                ctx.prisma.team_D4H.update({
                    where: { teamId, d4hTeamId: payload.d4hTeamId },
                    data: { lastSyncedAt: row.createdAt },
                }),
                ...(metadataItem?.organization
                    ? [
                          // Never moves backwards: a newer plan of another team may have finished
                          // first.
                          ctx.prisma.organization_D4H.updateMany({
                              where: {
                                  organizationId: ctx.organizationId,
                                  OR: [
                                      { lastSyncedAt: null },
                                      { lastSyncedAt: { lt: row.createdAt } },
                                  ],
                              },
                              data: { lastSyncedAt: row.createdAt },
                          }),
                      ]
                    : []),
                ...(metadataWrote
                    ? []
                    : [
                          ctxBatch.logEvent({
                              action: "Update",
                              objectType: "Team",
                              objectId: teamId,
                              description: "Synced with linked D4H team — no metadata changes.",
                          }),
                      ]),
            ]);
        } catch (e) {
            if (hasPrismaCode(e, "P2025")) throw linkChanged();
            throw e;
        }

        await BatchUpdatePlans.finish(
            ctx,
            planId,
            { status: "Completed", outcomes, logBatchId: batchId },
            new Date(),
        );
        return { plan: { id: planId, teamId, payload }, outcomes };
    } catch (e) {
        try {
            await BatchUpdatePlans.finish(
                ctx,
                planId,
                { status: "Failed", outcomes, logBatchId: batchId },
                new Date(),
            );
        } catch (finishError) {
            // The original error is the one worth reporting; cleanup marks the plan `Failed` later.
            console.error("Couldn't mark the D4H sync plan Failed:", finishError);
        }
        throw e;
    }
}

//
// Creating a persisted plan, and the link flow's immediate sync.
// See docs/plans/2026-10-19-d4h-sync-plans.md, "Router, flows and UI".
//

/** Fetch both sides of a linked team, shaped for `buildD4HSyncPlan`. */
export async function fetchD4HSyncPlanInput(
    ctx: OrgServiceContext,
    args: { teamD4H: TeamD4HRecord; token: D4HAccessToken_ServerOnly },
): Promise<BuildD4HSyncPlanInput> {
    const { teamD4H, token } = args;
    const credentialRef = toD4HCredentialRef(token);

    const [tokenMetadata, teamDetail, d4hMembers] = await Promise.all([
        getD4HTokenMetadata(credentialRef),
        fetchD4HTeamDetailCached(credentialRef, teamD4H.d4hTeamId),
        fetchD4HTeamMembersForSync(token, teamD4H.d4hTeamId),
    ]);

    const ref = tokenMetadata.d4HTeams.find((t) => t.id === teamD4H.d4hTeamId);
    if (!ref) {
        throw new NotFoundError(
            `D4H Team ${teamD4H.d4hTeamId} is no longer accessible with your token.`,
        );
    }
    const owningOrgId = ref.owner?.id ?? null;

    const [membershipRows, people, d4hOrg, orgRow] = await Promise.all([
        ctx.prisma.teamMembership.findMany({
            where: { teamId: teamD4H.teamId, organizationId: ctx.organizationId },
            include: { d4h: true, person: { select: { id: true, name: true, email: true } } },
        }),
        ctx.prisma.person.findMany({
            where: { organizationId: ctx.organizationId },
            select: { email: true, status: true },
        }),
        owningOrgId === null
            ? null
            : fetchD4HOrganisationCached(credentialRef, teamD4H.d4hTeamId, owningOrgId),
        owningOrgId === null
            ? null
            : ctx.prisma.organization_D4H.findUnique({
                  where: { organizationId: ctx.organizationId },
              }),
    ]);

    const emailsOf = (deleted: boolean) =>
        new Set(
            people
                .filter((p) => (p.status === "Deleted") === deleted)
                .map((p) => normaliseD4HEmail(p.email)),
        );

    return {
        d4hTeamId: teamD4H.d4hTeamId,
        d4hMembers,
        teamMemberships: membershipRows.map((row) => ({
            teamMembershipId: row.id,
            personId: row.person.id,
            personName: row.person.name,
            personEmail: row.person.email,
            status: row.status as D4HSyncTeamMembershipInput["status"],
            d4h: row.d4h
                ? {
                      d4hMemberId: row.d4h.d4hMemberId,
                      d4hStatus: row.d4h.d4hStatus,
                      d4hPosition: row.d4h.d4hPosition,
                      d4hRef: row.d4h.d4hRef,
                      d4hRoleId: row.d4h.d4hRoleId,
                  }
                : null,
        })),
        existingPersonEmails: emailsOf(false),
        deletedPersonEmails: emailsOf(true),
        metadata: {
            team: {
                before: {
                    d4hTeamName: teamD4H.d4hTeamName,
                    d4hOrganisationId: teamD4H.d4hOrganisationId,
                    d4hTimezone: teamD4H.d4hTimezone,
                },
                incoming: {
                    d4hTeamName: ref.title,
                    d4hOrganisationId: owningOrgId,
                    d4hTimezone: teamDetail.timezone,
                },
            },
            organization: d4hOrg
                ? {
                      before: {
                          d4hOrganisationName: orgRow?.d4hOrganisationName ?? null,
                          d4hTimezone: orgRow?.d4hTimezone ?? null,
                          d4hCurrency: orgRow?.d4hCurrency ?? null,
                          d4hReportingStartDay: orgRow?.d4hReportingStartDay ?? null,
                          d4hReportingStartMonth: orgRow?.d4hReportingStartMonth ?? null,
                      },
                      incoming: {
                          d4hOrganisationName: d4hOrg.title,
                          d4hTimezone: d4hOrg.timezone,
                          d4hCurrency: d4hOrg.currency,
                          d4hReportingStartDay: d4hOrg.reportingStartDay,
                          d4hReportingStartMonth: d4hOrg.reportingStartMonth,
                      },
                  }
                : null,
        },
    };
}

export type CreateD4HSyncPlanResult =
    | { status: "in-progress" }
    | { status: "ready"; planId: BatchUpdatePlanId; plan: D4HSyncPlan };

/**
 * Build a D4H sync plan for a linked team from a fresh fetch of both sides, and persist it as a
 * `Pending` `d4h-team-sync` `BatchUpdatePlan`. While another sync of the team is executing, returns
 * `in-progress` without fetching or building anything. The plan row is bookkeeping, not audited.
 */
export async function createD4HSyncPlan(
    ctx: OrgServiceContext,
    args: { teamD4H: TeamD4HRecord; token: D4HAccessToken_ServerOnly },
): Promise<CreateD4HSyncPlanResult> {
    const target: BatchUpdatePlans.PlanTarget = {
        kind: D4H_TEAM_SYNC_KIND,
        targetType: "Team",
        targetId: args.teamD4H.teamId,
    };
    if (await BatchUpdatePlans.findExecuting(ctx, target, new Date())) {
        return { status: "in-progress" };
    }

    const plan = buildD4HSyncPlan(await fetchD4HSyncPlanInput(ctx, args));
    const row = await BatchUpdatePlans.create(ctx, { ...target, payload: plan });
    return { status: "ready", planId: BatchUpdatePlanId.schema.parse(row.id), plan };
}

export type SyncImmediatelyResult =
    | { status: "in-progress" }
    | { status: "synced"; plan: D4HSyncPlan; outcomes: D4HSyncItemOutcome[] };

/**
 * Plan and execute straight away with nothing skipped: the first sync of a link or a
 * create-from-D4H, in the caller's `LogBatch`. Returns the executed plan, whose `skipped` the link
 * toast reads, with each item's outcome.
 *
 * Returns `in-progress`, syncing nothing, while another sync of the team is running (an unlink and
 * relink while an old run is still executing): the caller's link has already committed by then, so
 * it reports the link and asks for a sync later rather than failing.
 */
export async function syncImmediately(
    ctx: OrgServiceContext,
    args: { teamD4H: TeamD4HRecord; token: D4HAccessToken_ServerOnly; batchId: string },
): Promise<SyncImmediatelyResult> {
    const created = await createD4HSyncPlan(ctx, { teamD4H: args.teamD4H, token: args.token });
    if (created.status === "in-progress") return created;
    try {
        const { outcomes } = await executeD4HSyncPlan(ctx, {
            planId: created.planId,
            skipItemIds: [],
            openBatch: async () => args.batchId,
        });
        return { status: "synced", plan: created.plan, outcomes };
    } catch (e) {
        // Another sync claimed the team between creating this plan and claiming it.
        if (e instanceof BatchUpdatePlans.PlanAlreadyRunningError) return { status: "in-progress" };
        throw e;
    }
}
