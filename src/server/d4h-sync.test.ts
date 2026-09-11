/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { describe, expect, it } from "vitest";

import { D4HMember } from "@/lib/schemas/d4h/member";
import { isSyncPlanEmpty } from "@/lib/schemas/d4h-sync-plan";
import { TeamId } from "@/lib/schemas/team";
import { TeamMembershipId } from "@/lib/schemas/team-membership";

import { buildSyncPlan, BuildSyncPlanInput, SyncMembershipInput } from "./d4h-sync";

function member(overrides: Partial<D4HMember> & { id: number }): D4HMember {
    return D4HMember.schema.parse({
        id: overrides.id,
        resourceType: "Member",
        email: overrides.email ?? { value: `m${overrides.id}@example.com`, verified: true },
        name: overrides.name ?? `Member ${overrides.id}`,
        owner: { id: 4242, resourceType: "Team" },
        position: overrides.position ?? null,
        ref: overrides.ref ?? null,
        role: overrides.role ?? { id: null, resourceType: "Role" },
        status: overrides.status ?? "OPERATIONAL",
    });
}

function managed(
    over: Omit<Partial<SyncMembershipInput>, "snapshot"> & {
        d4hMemberId: number;
        snapshot?: Partial<SyncMembershipInput["snapshot"]>;
    },
): SyncMembershipInput {
    return {
        teamMembershipId: over.teamMembershipId ?? TeamMembershipId.create(),
        personName: over.personName ?? `Person ${over.d4hMemberId}`,
        membershipStatus: over.membershipStatus ?? "Active",
        snapshot: {
            d4hMemberId: over.d4hMemberId,
            d4hStatus: over.snapshot?.d4hStatus ?? "OPERATIONAL",
            d4hPosition: over.snapshot?.d4hPosition ?? null,
            d4hRef: over.snapshot?.d4hRef ?? null,
            d4hRoleId: over.snapshot?.d4hRoleId ?? null,
        },
    };
}

function base(over: Partial<BuildSyncPlanInput> = {}): BuildSyncPlanInput {
    return {
        teamId: TeamId.create(),
        d4hMembers: [],
        avutMemberships: [],
        existingPersonEmails: new Set(),
        manualMembershipEmails: new Set(),
        teamMetadata: { current: { d4hTeamName: "A" }, incoming: { d4hTeamName: "A" } },
        generatedAt: new Date("2026-09-10T00:00:00.000Z"),
        ...over,
    };
}

describe("buildSyncPlan — additions", () => {
    it("new person when the email is unknown", () => {
        const plan = buildSyncPlan(base({ d4hMembers: [member({ id: 1 })] }));
        expect(plan.additions).toHaveLength(1);
        expect(plan.additions[0]).toMatchObject({ personMatch: "new", adoptsMembership: false });
    });

    it("existing person when the email already resolves", () => {
        const plan = buildSyncPlan(
            base({
                d4hMembers: [member({ id: 1, email: { value: "a@x.com", verified: true } })],
                existingPersonEmails: new Set(["a@x.com"]),
            }),
        );
        expect(plan.additions[0].personMatch).toBe("existing");
    });

    it("adoptsMembership when a manual membership already joins the person", () => {
        const plan = buildSyncPlan(
            base({
                d4hMembers: [member({ id: 1, email: { value: "A@X.com", verified: true } })],
                manualMembershipEmails: new Set(["a@x.com"]),
            }),
        );
        expect(plan.additions[0].adoptsMembership).toBe(true);
    });
});

describe("buildSyncPlan — updates", () => {
    it("includes a membership whose snapshot changed", () => {
        const plan = buildSyncPlan(
            base({
                d4hMembers: [member({ id: 1, position: "Lead" })],
                avutMemberships: [managed({ d4hMemberId: 1 })],
            }),
        );
        expect(plan.updates).toHaveLength(1);
        expect(plan.counts.updates).toBe(1);
    });

    it("skips a membership whose snapshot is unchanged", () => {
        const plan = buildSyncPlan(
            base({
                d4hMembers: [member({ id: 1, position: "Lead" })],
                avutMemberships: [
                    managed({ d4hMemberId: 1, snapshot: { d4hMemberId: 1, d4hPosition: "Lead" } }),
                ],
            }),
        );
        expect(plan.updates).toHaveLength(0);
        expect(isSyncPlanEmpty(plan)).toBe(true);
    });
});

describe("buildSyncPlan — archival & reactivation", () => {
    it("archives an active membership no longer in D4H", () => {
        const plan = buildSyncPlan(
            base({ d4hMembers: [], avutMemberships: [managed({ d4hMemberId: 9 })] }),
        );
        expect(plan.archivals).toHaveLength(1);
    });

    it("does not archive an already-archived membership", () => {
        const plan = buildSyncPlan(
            base({
                d4hMembers: [],
                avutMemberships: [managed({ d4hMemberId: 9, membershipStatus: "Archived" })],
            }),
        );
        expect(isSyncPlanEmpty(plan)).toBe(true);
    });

    it("reactivates an archived membership that reappears in D4H", () => {
        const plan = buildSyncPlan(
            base({
                d4hMembers: [member({ id: 9 })],
                avutMemberships: [managed({ d4hMemberId: 9, membershipStatus: "Archived" })],
            }),
        );
        expect(plan.reactivations).toHaveLength(1);
        expect(plan.updates).toHaveLength(0);
    });
});

describe("buildSyncPlan — metadata & planToken", () => {
    it("reports a non-empty team metadata diff", () => {
        const plan = buildSyncPlan(
            base({
                teamMetadata: { current: { d4hTeamName: "Old" }, incoming: { d4hTeamName: "New" } },
            }),
        );
        expect(plan.teamMetadataChanges.length).toBeGreaterThan(0);
        expect(isSyncPlanEmpty(plan)).toBe(false);
    });

    it("planToken is independent of member order", () => {
        const a = buildSyncPlan(base({ d4hMembers: [member({ id: 1 }), member({ id: 2 })] }));
        const b = buildSyncPlan(base({ d4hMembers: [member({ id: 2 }), member({ id: 1 })] }));
        expect(a.planToken).toBe(b.planToken);
    });

    it("planToken changes when a member field changes", () => {
        const a = buildSyncPlan(base({ d4hMembers: [member({ id: 1, position: "A" })] }));
        const b = buildSyncPlan(base({ d4hMembers: [member({ id: 1, position: "B" })] }));
        expect(a.planToken).not.toBe(b.planToken);
    });

    it("an all-quiet input yields an empty plan", () => {
        expect(isSyncPlanEmpty(buildSyncPlan(base()))).toBe(true);
    });
});
