/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 *  D4H linking & team synchronisation. See docs/specs/2026-09-10-d4h-linking.md and docs/plans/2026-09-10-d4h-linking.md.
 */

import "server-only";

import { createHash } from "node:crypto";

import type { Prisma } from "@/generated/prisma/client";
import { diffObject } from "@/lib/diff";
import {
    ConflictError,
    NotFoundError,
    PreconditionError,
    StalePlanError,
    ValidationError,
} from "@/lib/errors";
import { BatchUpdatePlanId } from "@/lib/schemas/batch-update-plan";
import { D4HAccessToken_ServerOnly } from "@/lib/schemas/d4h-access-token";
import {
    D4HSyncItem,
    D4HSyncItemDraft,
    D4HSyncItemOutcome,
    D4HSyncPlan,
    D4HSyncSkipReason,
    SyncPlan,
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
// Pure, deterministic sync-plan builder — no Prisma, no D4H API. Unit-tested directly
// (`d4h-team-sync.test.ts`). See docs/specs/2026-09-10-d4h-linking.md §7.
//

/** The `TeamMembership_D4H` snapshot fields, in the shape `diffObject` compares. */
export type D4HMembershipSnapshot = {
    d4hStatus: string;
    d4hPosition: string | null;
    d4hRef: string | null;
    d4hRoleId: number | null;
};

/** One D4H-managed AVUT membership fed to the builder — includes `Archived` ones. */
export type SyncMembershipInput = {
    teamMembershipId: string;
    personName: string;
    membershipStatus: "Active" | "Archived" | "Deleted";
    snapshot: D4HMembershipSnapshot & { d4hMemberId: number };
};

/** `Team_D4H` (+ `Organization_D4H`) cache fields, before and after this sync. */
export type SyncTeamMetadata = {
    current: Record<string, string | number | null>;
    incoming: Record<string, string | number | null>;
};

export type BuildSyncPlanInput = {
    teamId: string;
    /** D4H members already filtered to OPERATIONAL + NON_OPERATIONAL. */
    d4hMembers: D4HMember[];
    /** All D4H-managed memberships (those with a `_D4H` row), including archived. */
    avutMemberships: SyncMembershipInput[];
    /** Lowercased emails of people that already resolve in the org (not `Deleted`). */
    existingPersonEmails: ReadonlySet<string>;
    /**
     * Lowercased emails of `Deleted` people. Email stays unique across the Rubbish bin, so these
     * members are skipped rather than adopting (or colliding with) the deleted person (#183).
     */
    deletedPersonEmails: ReadonlySet<string>;
    /** Lowercased emails of people joined to this team by a *manual* membership. */
    manualMembershipEmails: ReadonlySet<string>;
    teamMetadata: SyncTeamMetadata;
    /** Injected in tests for a stable `generatedAt`. */
    generatedAt?: Date;
};

export function snapshotFromD4HMember(member: D4HMember): D4HMembershipSnapshot {
    return {
        d4hStatus: member.status,
        d4hPosition: member.position,
        d4hRef: member.ref,
        d4hRoleId: member.role.id,
    };
}

function byNameThenId<T extends { personName?: string; name?: string }>(a: T, b: T): number {
    const an = a.personName ?? a.name ?? "";
    const bn = b.personName ?? b.name ?? "";
    return an.localeCompare(bn);
}

/** sha256 of the normalised D4H input — the value `planToken` carries. */
export function computePlanToken(input: {
    d4hMembers: D4HMember[];
    incomingMetadata: Record<string, string | number | null>;
}): string {
    const members = input.d4hMembers
        .map((m) => ({
            id: m.id,
            name: m.name,
            email: m.email.value.toLowerCase(),
            status: m.status,
            position: m.position,
            ref: m.ref,
            roleId: m.role.id,
        }))
        .sort((a, b) => a.id - b.id);

    const metadata = Object.fromEntries(
        Object.entries(input.incomingMetadata).sort(([a], [b]) => a.localeCompare(b)),
    );

    return createHash("sha256").update(JSON.stringify({ members, metadata })).digest("hex");
}

export function buildSyncPlan(input: BuildSyncPlanInput): SyncPlan {
    const generatedAt = (input.generatedAt ?? new Date()).toISOString();

    // Deleted memberships are inert — never reconciled.
    const managed = input.avutMemberships.filter((m) => m.membershipStatus !== "Deleted");
    const byMemberId = new Map(managed.map((m) => [m.snapshot.d4hMemberId, m]));
    const seenMemberIds = new Set<number>();

    // Built with plain strings; `SyncPlan.schema.parse` at the end applies the brands.
    const additions: Array<{
        d4hMemberId: number;
        name: string;
        email: string;
        status: D4HMember["status"];
        personMatch: "existing" | "new";
        adoptsMembership: boolean;
    }> = [];
    const updates: Array<{
        teamMembershipId: string;
        d4hMemberId: number;
        personName: string;
        changes: ReturnType<typeof diffObject>;
    }> = [];
    const reactivations: typeof updates = [];
    const archivals: Array<{ teamMembershipId: string; personName: string }> = [];
    const skipped: Array<{
        d4hMemberId: number;
        name: string;
        reason: "missing-email" | "person-in-rubbish-bin";
    }> = [];

    for (const member of input.d4hMembers) {
        seenMemberIds.add(member.id);
        const existing = byMemberId.get(member.id);
        const incoming = snapshotFromD4HMember(member);

        if (!existing) {
            const email = member.email.value.trim().toLowerCase();
            if (!email) {
                skipped.push({
                    d4hMemberId: member.id,
                    name: member.name,
                    reason: "missing-email",
                });
                continue;
            }
            if (input.deletedPersonEmails.has(email)) {
                skipped.push({
                    d4hMemberId: member.id,
                    name: member.name,
                    reason: "person-in-rubbish-bin",
                });
                continue;
            }
            additions.push({
                d4hMemberId: member.id,
                name: member.name,
                email: member.email.value,
                status: member.status,
                personMatch: input.existingPersonEmails.has(email) ? "existing" : "new",
                adoptsMembership: input.manualMembershipEmails.has(email),
            });
            continue;
        }

        const changes = diffObject(
            {
                d4hStatus: existing.snapshot.d4hStatus,
                d4hPosition: existing.snapshot.d4hPosition,
                d4hRef: existing.snapshot.d4hRef,
                d4hRoleId: existing.snapshot.d4hRoleId,
            },
            { ...incoming },
        );

        if (existing.membershipStatus === "Archived") {
            reactivations.push({
                teamMembershipId: existing.teamMembershipId,
                d4hMemberId: member.id,
                personName: existing.personName,
                changes,
            });
        } else if (changes.length > 0) {
            updates.push({
                teamMembershipId: existing.teamMembershipId,
                d4hMemberId: member.id,
                personName: existing.personName,
                changes,
            });
        }
    }

    for (const membership of managed) {
        if (seenMemberIds.has(membership.snapshot.d4hMemberId)) continue;
        if (membership.membershipStatus !== "Active") continue;
        archivals.push({
            teamMembershipId: membership.teamMembershipId,
            personName: membership.personName,
        });
    }

    additions.sort((a, b) => byNameThenId(a, b) || a.d4hMemberId - b.d4hMemberId);
    updates.sort(
        (a, b) => byNameThenId(a, b) || a.teamMembershipId.localeCompare(b.teamMembershipId),
    );
    reactivations.sort(
        (a, b) => byNameThenId(a, b) || a.teamMembershipId.localeCompare(b.teamMembershipId),
    );
    archivals.sort(
        (a, b) => byNameThenId(a, b) || a.teamMembershipId.localeCompare(b.teamMembershipId),
    );
    skipped.sort((a, b) => byNameThenId(a, b) || a.d4hMemberId - b.d4hMemberId);

    const teamMetadataChanges = diffObject(input.teamMetadata.current, input.teamMetadata.incoming);

    return SyncPlan.schema.parse({
        teamId: input.teamId,
        generatedAt,
        planToken: computePlanToken({
            d4hMembers: input.d4hMembers,
            incomingMetadata: input.teamMetadata.incoming,
        }),
        additions,
        skipped,
        updates,
        archivals,
        reactivations,
        teamMetadataChanges,
        counts: {
            additions: additions.length,
            skipped: skipped.length,
            updates: updates.length,
            archivals: archivals.length,
            reactivations: reactivations.length,
        },
    });
}

//
// Pure builder for the persisted plan (`D4HSyncPlan`), the payload of a `d4h-team-sync`
// `BatchUpdatePlan`. See docs/plans/2026-10-19-d4h-sync-plans.md, "Plan builder rules".
//

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
 * 2. email shared with another D4H member → skipped `duplicate-email` (#144)
 * 3. email of a `Deleted` person → skipped `person-in-rubbish-bin` (#183)
 * 4. the person's membership on this team is `Deleted` → skipped `membership-in-rubbish-bin`
 * 5. the person's membership is linked to a D4H member who is gone → `relink`
 * 6. the person's membership is linked to another D4H member who is still in D4H → skipped
 *    `linked-to-another-member`
 * 7. otherwise → `add`
 *
 * An `Active` linked membership whose member is gone, and that isn't relinked, is archived.
 */
export function buildD4HSyncPlan(input: BuildD4HSyncPlanInput): D4HSyncPlan {
    const linked = input.teamMemberships.flatMap((m) =>
        m.d4h !== null && m.status !== "Deleted" ? [{ ...m, d4h: m.d4h, status: m.status }] : [],
    );
    const linkedByMemberId = new Map(linked.map((m) => [m.d4h.d4hMemberId, m]));
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
// Orchestration — fetches D4H data, applies plans, and writes AVUT records.
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

type TeamMetaRecord = Record<string, string | number | null>;

type SyncInputs = {
    teamId: string;
    d4hMembers: D4HMember[];
    d4hMembersById: Map<number, D4HMember>;
    avutMemberships: Parameters<typeof buildSyncPlan>[0]["avutMemberships"];
    membershipPersonIds: Map<string, string>;
    existingPersonEmails: Set<string>;
    deletedPersonEmails: Set<string>;
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
    ctx: OrgServiceContext,
    args: { teamD4H: TeamD4HRecord; token: D4HAccessToken_ServerOnly },
): Promise<SyncInputs> {
    const { teamD4H, token } = args;
    const teamId = teamD4H.teamId;
    const credentialRef = toD4HCredentialRef(token);

    const [metadata, teamDetail, d4hMembers] = await Promise.all([
        getD4HTokenMetadata(credentialRef),
        fetchD4HTeamDetailCached(credentialRef, teamD4H.d4hTeamId),
        fetchD4HTeamMembersForSync(token, teamD4H.d4hTeamId),
    ]);

    const ref = metadata.d4HTeams.find((t) => t.id === teamD4H.d4hTeamId);
    if (!ref) {
        throw new NotFoundError(
            `D4H Team ${teamD4H.d4hTeamId} is no longer accessible with your token.`,
        );
    }
    const owningOrgId = ref.owner?.id ?? null;

    const [managedRows, allPeople, manualRows] = await Promise.all([
        ctx.prisma.teamMembership.findMany({
            where: { teamId, organizationId: ctx.organizationId, d4h: { isNot: null } },
            include: { d4h: true, person: { select: { id: true, name: true, email: true } } },
        }),
        ctx.prisma.person.findMany({
            where: { organizationId: ctx.organizationId },
            select: { email: true, status: true },
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
            fetchD4HOrganisationCached(credentialRef, teamD4H.d4hTeamId, owningOrgId),
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
        existingPersonEmails: new Set(
            allPeople.filter((p) => p.status !== "Deleted").map((p) => p.email.toLowerCase()),
        ),
        deletedPersonEmails: new Set(
            allPeople.filter((p) => p.status === "Deleted").map((p) => p.email.toLowerCase()),
        ),
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
        deletedPersonEmails: inputs.deletedPersonEmails,
        manualMembershipEmails: inputs.manualMembershipEmails,
        teamMetadata: { current: inputs.currentMeta, incoming: inputs.incomingMeta },
    });
}

/** Build a fresh plan for a linked team, no writes. */
export async function planD4HSync(
    ctx: OrgServiceContext,
    args: { teamD4H: TeamD4HRecord; token: D4HAccessToken_ServerOnly },
): Promise<SyncPlan> {
    return planFromInputs(await fetchD4HSyncInputs(ctx, args));
}

/**
 * Adopt an already-existing `TeamMembership` row as D4H-managed — the "found on lookup"
 * path of an addition, and also the recovery path when a concurrent sync/manual add wins
 * the race to create the row first (see the `P2002` catch below).
 */
async function adoptExistingMembership(
    /** Already bound to the sync's batch — see `applyD4HSyncPlan`. */
    ctx: OrgServiceContext,
    args: {
        existing: { id: string; status: string };
        personId: string;
        teamId: string;
        d4hMemberId: number;
        snap: D4HMembershipSnapshot;
    },
): Promise<void> {
    const { existing, personId, teamId, d4hMemberId, snap } = args;
    await ctx.prisma.$transaction([
        ctx.prisma.teamMembership.update({
            where: { id: existing.id },
            data: {
                status: "Active",
                d4h: {
                    upsert: {
                        create: { d4hMemberId, ...snap },
                        update: { d4hMemberId, ...snap },
                    },
                },
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
    ]);
}

/**
 * Apply an already-computed plan. One `$transaction` per independently-meaningful row.
 *
 * Binds `ctx` to the sync's batch once via `withBatch`, so every `logEvent` below (and every
 * `Personnel` service call it makes) joins that batch without threading a `batchId` parameter
 * through each one.
 */
async function applyD4HSyncPlan(
    ctx: OrgServiceContext,
    args: { plan: SyncPlan; inputs: SyncInputs; batchId: string },
): Promise<void> {
    const { plan, inputs } = args;
    const ctxBatch = withBatch(ctx, args.batchId);
    const teamId = inputs.teamId;
    const now = new Date();

    for (const add of plan.additions) {
        const member = inputs.d4hMembersById.get(add.d4hMemberId);
        if (!member) continue;
        const snap = snapshotFromD4HMember(member);

        let person = await Personnel.getByEmail(ctxBatch, add.email);
        if (!person) {
            person = (
                await Personnel.create(ctxBatch, PersonId.create(), {
                    name: add.name,
                    email: add.email,
                    tags: [],
                    properties: {},
                })
            ).created;
        }

        const existing = await ctx.prisma.teamMembership.findUnique({
            where: { teamId_personId: { teamId, personId: person.id } },
            select: { id: true, status: true },
        });

        if (existing) {
            await adoptExistingMembership(ctxBatch, {
                existing,
                personId: person.id,
                teamId,
                d4hMemberId: add.d4hMemberId,
                snap,
            });
        } else {
            const tmId = TeamMembershipId.create();
            try {
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
                    ctxBatch.logEvent({
                        action: "Create",
                        objectType: "TeamMembership",
                        objectId: tmId,
                        description: "Added from linked D4H team.",
                        refs: personTeamRefs(person.id, teamId),
                    }),
                ]);
            } catch (e) {
                // Lost a race with a concurrent sync (or a manual add) that created this
                // membership between our findUnique above and this create — adopt the row
                // it created instead of failing the whole sync.
                if (!(e instanceof Object && "code" in e && e.code === "P2002")) throw e;

                const raced = await ctx.prisma.teamMembership.findUniqueOrThrow({
                    where: { teamId_personId: { teamId, personId: person.id } },
                    select: { id: true, status: true },
                });
                await adoptExistingMembership(ctxBatch, {
                    existing: raced,
                    personId: person.id,
                    teamId,
                    d4hMemberId: add.d4hMemberId,
                    snap,
                });
            }
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
            ctxBatch.logEvent({
                action: "Update",
                objectType: "TeamMembership",
                objectId: upd.teamMembershipId,
                changes: upd.changes,
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
            ctxBatch.logEvent({
                action: "Update",
                objectType: "TeamMembership",
                objectId: react.teamMembershipId,
                description: "Reactivated — member is back in the linked D4H team.",
                changes: [
                    ...diffObject({ status: "Archived" }, { status: "Active" }),
                    ...react.changes,
                ],
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
            ctxBatch.logEvent({
                action: "Update",
                objectType: "TeamMembership",
                objectId: arch.teamMembershipId,
                description: "Archived — member is no longer in the linked D4H team.",
                changes: diffObject({ status: "Active" }, { status: "Archived" }),
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
            ctxBatch.logEvent({
                action: "Update",
                objectType: "Team",
                objectId: teamId,
                description: "Refreshed D4H team metadata.",
                changes: teamDiff,
            }),
        ]);
    } else {
        await ctx.prisma.$transaction([
            ctx.prisma.team_D4H.update({ where: { teamId }, data: { lastSyncedAt: now } }),
            ctxBatch.logEvent({
                action: "Update",
                objectType: "Team",
                objectId: teamId,
                description: "Synced with linked D4H team — no metadata changes.",
            }),
        ]);
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
                ctxBatch.logEvent({
                    action: "Update",
                    objectType: "Organization",
                    objectId: ctx.organizationId,
                    description: "Refreshed cached D4H organisation attributes.",
                    changes: orgDiff,
                }),
            ]);
        } else {
            await ctx.prisma.$transaction([
                ctx.prisma.organization_D4H.update({
                    where: { organizationId: ctx.organizationId },
                    data: { lastSyncedAt: now },
                }),
                ctxBatch.logEvent({
                    action: "Update",
                    objectType: "Organization",
                    objectId: ctx.organizationId,
                    description: "Synced cached D4H organisation attributes — no changes.",
                }),
            ]);
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

/**
 * Fetch → plan → (optionally match token) → apply. Used by link/create (no token
 * to match) and by `applyD4HTeamSync` (must match the previewed `planToken`).
 */
export async function runTeamSync(
    ctx: OrgServiceContext,
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
        throw new StalePlanError();
    }

    await applyD4HSyncPlan(ctx, { plan, inputs, batchId: args.batchId });
    return { plan };
}

//
// Executing a persisted plan (`D4HSyncPlan`, the payload of a `d4h-team-sync` `BatchUpdatePlan`).
// See docs/plans/2026-10-19-d4h-sync-plans.md, "The D4H payload and executor".
//

export const D4H_TEAM_SYNC_KIND = "d4h-team-sync";

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
const changed = (reason: string): ItemResult => ({ result: "skipped-changed", reason });

function isUniqueViolation(e: unknown): boolean {
    return e instanceof Object && "code" in e && e.code === "P2002";
}

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
    const rows = await ctx.prisma.teamMembership_D4H.findMany({
        where: { d4hMemberId },
        include: { teamMembership: { select: { teamId: true, organizationId: true } } },
    });
    return rows.some(
        (r) =>
            r.teamMembership.teamId === teamId &&
            r.teamMembership.organizationId === ctx.organizationId,
    );
}

/** A membership of this team with its D4H link, or null if it no longer exists. */
function findTeamMembership(ctx: OrgServiceContext, teamId: string, teamMembershipId: string) {
    return ctx.prisma.teamMembership.findFirst({
        where: { id: teamMembershipId, teamId, organizationId: ctx.organizationId },
        select: { id: true, status: true, d4h: true },
    });
}

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

    /** Take over the person's existing membership on this team, if it's a live manual one. */
    const takeOver = async (existing: {
        id: string;
        status: string;
        d4h: { d4hMemberId: number } | null;
    }): Promise<ItemResult> => {
        if (existing.status === "Deleted") return changed("membership-in-rubbish-bin");
        if (existing.d4h) return changed("linked-to-another-member");
        await ctx.prisma.$transaction([
            ctx.prisma.teamMembership.update({
                where: { id: existing.id },
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
        ]);
        return applied;
    };

    const membershipOfPerson = () =>
        ctx.prisma.teamMembership.findUnique({
            where: { teamId_personId: { teamId, personId } },
            select: { id: true, status: true, d4h: { select: { d4hMemberId: true } } },
        });

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
    const membership = await findTeamMembership(ctx, teamId, item.teamMembershipId);
    if (!membership) return changed("membership-missing");
    if (membership.status === "Deleted") return changed("membership-in-rubbish-bin");
    if (membership.d4h?.d4hMemberId !== item.previousD4hMemberId) {
        return changed("d4h-member-changed");
    }
    if (await isLinkedOnTeam(ctx, teamId, item.d4hMemberId)) return changed("already-linked");

    const reactivates = membership.status === "Archived";
    await ctx.prisma.$transaction([
        ctx.prisma.teamMembership.update({
            where: { id: membership.id },
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
                ...(reactivates ? diffObject({ status: "Archived" }, { status: "Active" }) : []),
                ...diffObject(snapshotOf(membership.d4h), item.incoming),
            ],
            refs: personTeamRefs(item.personId, teamId),
        }),
    ]);
    return applied;
}

async function executeUpdate(
    ctx: OrgServiceContext,
    teamId: string,
    item: UpdateItem,
): Promise<ItemResult> {
    const membership = await findTeamMembership(ctx, teamId, item.teamMembershipId);
    if (!membership) return changed("membership-missing");
    if (membership.status === "Deleted") return changed("membership-in-rubbish-bin");
    if (membership.d4h?.d4hMemberId !== item.d4hMemberId) return changed("d4h-member-changed");
    if (!sameSnapshot(membership.d4h, item.before)) return changed("details-changed");

    await ctx.prisma.$transaction([
        ctx.prisma.teamMembership_D4H.update({
            where: { teamMembershipId: membership.id },
            data: item.incoming,
        }),
        ctx.logEvent({
            action: "Update",
            objectType: "TeamMembership",
            objectId: membership.id,
            changes: item.changes,
            refs: personTeamRefs(item.personId, teamId),
        }),
    ]);
    return applied;
}

async function executeReactivate(
    ctx: OrgServiceContext,
    teamId: string,
    item: ReactivateItem,
): Promise<ItemResult> {
    const membership = await findTeamMembership(ctx, teamId, item.teamMembershipId);
    if (!membership) return changed("membership-missing");
    if (membership.status !== "Archived") return changed("not-archived");
    if (membership.d4h?.d4hMemberId !== item.d4hMemberId) return changed("d4h-member-changed");

    await ctx.prisma.$transaction([
        ctx.prisma.teamMembership.update({
            where: { id: membership.id },
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
    ]);
    return applied;
}

async function executeArchive(
    ctx: OrgServiceContext,
    teamId: string,
    item: ArchiveItem,
): Promise<ItemResult> {
    const membership = await findTeamMembership(ctx, teamId, item.teamMembershipId);
    if (!membership) return changed("membership-missing");
    if (membership.status !== "Active") return changed("not-active");
    if (membership.d4h?.d4hMemberId !== item.d4hMemberId) return changed("d4h-member-changed");

    await ctx.prisma.$transaction([
        ctx.prisma.teamMembership.update({
            where: { id: membership.id },
            data: { status: "Archived" },
        }),
        ctx.logEvent({
            action: "Update",
            objectType: "TeamMembership",
            objectId: membership.id,
            description: "Archived — member is no longer in the linked D4H team.",
            changes: diffObject({ status: "Active" }, { status: "Archived" }),
            refs: personTeamRefs(item.personId, teamId),
        }),
    ]);
    return applied;
}

type FieldValue = string | number | null;

/**
 * Gate one cache row's fields on the plan's `before`: of the fields the plan changes, write those
 * whose current value still equals `before`, and report the others by their display key. A missing
 * row reports every field the plan changes.
 */
function gateFields<T extends Record<string, FieldValue>>(
    displayKeys: NoInfer<{ [K in keyof T]: string }>,
    before: T,
    incoming: NoInfer<T>,
    current: NoInfer<T> | null,
) {
    const write: Partial<T> = {};
    const writeBefore: Partial<T> = {};
    const skippedFields: string[] = [];
    for (const key of Object.keys(displayKeys) as (keyof T)[]) {
        if (incoming[key] === before[key]) continue;
        if (current === null || current[key] !== before[key]) {
            skippedFields.push(displayKeys[key]);
            continue;
        }
        write[key] = incoming[key];
        writeBefore[key] = before[key];
    }
    return { write, writeBefore, skippedFields };
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

    const writes: Prisma.PrismaPromise<unknown>[] = [];
    if (Object.keys(team.write).length > 0) {
        writes.push(
            ctx.prisma.team_D4H.update({ where: { teamId }, data: team.write }),
            ctx.logEvent({
                action: "Update",
                objectType: "Team",
                objectId: teamId,
                description: "Refreshed D4H team metadata.",
                changes: diffObject(team.writeBefore, team.write),
            }),
        );
    }
    if (org && Object.keys(org.write).length > 0) {
        writes.push(
            ctx.prisma.organization_D4H.update({
                where: { organizationId: ctx.organizationId },
                data: org.write,
            }),
            ctx.logEvent({
                action: "Update",
                objectType: "Organization",
                objectId: ctx.organizationId,
                description: "Refreshed cached D4H organisation attributes.",
                changes: diffObject(org.writeBefore, org.write),
            }),
        );
    }

    const skippedFields = [...team.skippedFields, ...(org?.skippedFields ?? [])];
    if (writes.length === 0 && skippedFields.length > 0) {
        return { result: "skipped-changed", reason: "fields-changed", skippedFields };
    }
    if (writes.length > 0) await ctx.prisma.$transaction(writes);
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
 * with its `logEvent`, joined to `batchId`.
 *
 * On success the plan is `Completed`, and `Team_D4H.lastSyncedAt` (and `Organization_D4H`'s, for
 * an org-bearing team) is set to the plan's `createdAt`, the time of the snapshot. If an item
 * throws, the plan is `Failed` with the outcomes so far, `lastSyncedAt` is left alone, and the
 * error is rethrown.
 *
 * @throws NotFoundError if the plan does not exist within the organization.
 * @throws ConflictError if the plan isn't a D4H team sync, its team is no longer active or no
 *   longer linked to the plan's D4H team, or the plan can't be claimed (already run, superseded,
 *   expired, or another sync of the team is running).
 */
export async function executeD4HSyncPlan(
    ctx: OrgServiceContext,
    args: { planId: BatchUpdatePlanId; skipItemIds: readonly string[]; batchId: string },
): Promise<{
    plan: { id: BatchUpdatePlanId; teamId: TeamId; payload: D4HSyncPlan };
    outcomes: D4HSyncItemOutcome[];
}> {
    const { planId, batchId } = args;
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

    await BatchUpdatePlans.claim(ctx, planId, new Date());

    const ctxBatch = withBatch(ctx, batchId);
    const skip = new Set(args.skipItemIds);
    const outcomes: D4HSyncItemOutcome[] = [];

    try {
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

        // Bookkeeping, not audited: AVUT reflects D4H as of the plan's snapshot.
        await ctx.prisma.team_D4H.update({
            where: { teamId },
            data: { lastSyncedAt: row.createdAt },
        });
        const orgBearing = payload.items.some(
            (item) => item.kind === "metadata" && item.organization !== null,
        );
        if (orgBearing) {
            await ctx.prisma.organization_D4H.updateMany({
                where: { organizationId: ctx.organizationId },
                data: { lastSyncedAt: row.createdAt },
            });
        }

        await BatchUpdatePlans.finish(ctx, planId, {
            status: "Completed",
            outcomes,
            logBatchId: batchId,
        });
        return { plan: { id: planId, teamId, payload }, outcomes };
    } catch (e) {
        await BatchUpdatePlans.finish(ctx, planId, {
            status: "Failed",
            outcomes,
            logBatchId: batchId,
        });
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

/**
 * Plan and execute straight away with nothing skipped: the first sync of a link or a
 * create-from-D4H, in the caller's `LogBatch`. Returns the executed plan, whose `counts` and
 * `skipped` the link toast reads, with each item's outcome.
 *
 * @throws ConflictError if another sync of the team is already running.
 */
export async function syncImmediately(
    ctx: OrgServiceContext,
    args: { teamD4H: TeamD4HRecord; token: D4HAccessToken_ServerOnly; batchId: string },
): Promise<{ plan: D4HSyncPlan; outcomes: D4HSyncItemOutcome[] }> {
    const created = await createD4HSyncPlan(ctx, { teamD4H: args.teamD4H, token: args.token });
    if (created.status === "in-progress") {
        throw new ConflictError("A sync of this team is already running.");
    }
    const { outcomes } = await executeD4HSyncPlan(ctx, {
        planId: created.planId,
        skipItemIds: [],
        batchId: args.batchId,
    });
    return { plan: created.plan, outcomes };
}
