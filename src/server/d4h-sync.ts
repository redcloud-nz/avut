/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 *  Pure, Prisma-free sync-plan builder. Deterministic and unit-tested
 *  (`d4h-sync.test.ts`). See docs/specs/d4h-linking.md §7.
 */

import { createHash } from "node:crypto";

import { diffObject } from "@/lib/diff";
import { D4HMember } from "@/lib/schemas/d4h/member";
import { SyncPlan } from "@/lib/schemas/d4h-sync-plan";

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
    /** Lowercased emails of people that already resolve in the org. */
    existingPersonEmails: ReadonlySet<string>;
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

    for (const member of input.d4hMembers) {
        seenMemberIds.add(member.id);
        const existing = byMemberId.get(member.id);
        const incoming = snapshotFromD4HMember(member);

        if (!existing) {
            const email = member.email.value.toLowerCase();
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

    const teamMetadataChanges = diffObject(input.teamMetadata.current, input.teamMetadata.incoming);

    return SyncPlan.schema.parse({
        teamId: input.teamId,
        generatedAt,
        planToken: computePlanToken({
            d4hMembers: input.d4hMembers,
            incomingMetadata: input.teamMetadata.incoming,
        }),
        additions,
        updates,
        archivals,
        reactivations,
        teamMetadataChanges,
        counts: {
            additions: additions.length,
            updates: updates.length,
            archivals: archivals.length,
            reactivations: reactivations.length,
        },
    });
}
