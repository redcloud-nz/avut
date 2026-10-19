/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { describe, expect, it } from "vitest";

import {
    D4HSyncItem,
    D4HSyncPlan,
    isD4HSyncPlanEmpty,
    isSyncPlanEmpty,
} from "@/lib/schemas/d4h-sync-plan";
import { D4HMember } from "@/lib/schemas/d4h/member";
import { PersonId } from "@/lib/schemas/person";
import { TeamId } from "@/lib/schemas/team";
import { TeamMembershipId } from "@/lib/schemas/team-membership";

import {
    buildD4HSyncPlan,
    BuildD4HSyncPlanInput,
    buildSyncPlan,
    BuildSyncPlanInput,
    D4HMembershipSnapshot,
    D4HSyncTeamMembershipInput,
    SyncMembershipInput,
} from "./d4h-team-sync";

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
        deletedPersonEmails: new Set(),
        manualMembershipEmails: new Set(),
        teamMetadata: { current: { d4hTeamName: "A" }, incoming: { d4hTeamName: "A" } },
        generatedAt: new Date("2026-09-10T00:00:00.000Z"),
        ...over,
    };
}

describe("buildSyncPlan — additions", () => {
    it("skips a member whose email belongs to a person in the Rubbish bin (#183)", () => {
        const plan = buildSyncPlan(
            base({
                d4hMembers: [member({ id: 1, email: { value: "Gone@x.com", verified: true } })],
                deletedPersonEmails: new Set(["gone@x.com"]),
            }),
        );
        expect(plan.additions).toHaveLength(0);
        expect(plan.skipped).toEqual([
            expect.objectContaining({ d4hMemberId: 1, reason: "person-in-rubbish-bin" }),
        ]);
        expect(plan.counts.skipped).toBe(1);
    });

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

    it("skips a member with a blank email instead of adding it", () => {
        const plan = buildSyncPlan(
            base({
                d4hMembers: [
                    member({ id: 1, email: { value: "", verified: false } }),
                    member({ id: 2, email: { value: "   ", verified: false } }),
                    member({ id: 3 }),
                ],
            }),
        );
        expect(plan.additions).toHaveLength(1);
        expect(plan.additions[0].d4hMemberId).toBe(3);
        expect(plan.skipped).toHaveLength(2);
        expect(plan.skipped.map((s) => s.d4hMemberId).sort()).toEqual([1, 2]);
        expect(plan.skipped[0]).toMatchObject({ reason: "missing-email" });
        expect(plan.counts.skipped).toBe(2);
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

//
// buildD4HSyncPlan — the persisted-plan builder.
//

function tm(
    over: Partial<Omit<D4HSyncTeamMembershipInput, "d4h">> & {
        email: string;
        d4h?: (Partial<D4HMembershipSnapshot> & { d4hMemberId: number }) | null;
    },
): D4HSyncTeamMembershipInput {
    const { email, d4h, ...rest } = over;
    return {
        teamMembershipId: TeamMembershipId.create(),
        personId: PersonId.create(),
        personName: `Person ${email}`,
        personEmail: email,
        status: "Active",
        d4h:
            d4h === null || d4h === undefined
                ? null
                : {
                      d4hMemberId: d4h.d4hMemberId,
                      d4hStatus: d4h.d4hStatus ?? "OPERATIONAL",
                      d4hPosition: d4h.d4hPosition ?? null,
                      d4hRef: d4h.d4hRef ?? null,
                      d4hRoleId: d4h.d4hRoleId ?? null,
                  },
        ...rest,
    };
}

const quietTeam = { d4hTeamName: "A", d4hOrganisationId: null, d4hTimezone: null };

function input(over: Partial<BuildD4HSyncPlanInput> = {}): BuildD4HSyncPlanInput {
    return {
        d4hTeamId: 4242,
        d4hMembers: [],
        teamMemberships: [],
        existingPersonEmails: new Set(),
        deletedPersonEmails: new Set(),
        metadata: { team: { before: quietTeam, incoming: quietTeam }, organization: null },
        ...over,
    };
}

const email = (value: string) => ({ value, verified: true });

function itemsOf<K extends D4HSyncItem["kind"]>(plan: D4HSyncPlan, kind: K) {
    return plan.items.filter((i): i is Extract<D4HSyncItem, { kind: K }> => i.kind === kind);
}

describe("buildD4HSyncPlan — skip rules", () => {
    it("reports several blank emails as missing-email only, not duplicate-email", () => {
        const plan = buildD4HSyncPlan(
            input({
                d4hMembers: [
                    member({ id: 1, email: { value: "", verified: false } }),
                    member({ id: 2, email: { value: "  ", verified: false } }),
                    member({ id: 3, email: { value: "", verified: false } }),
                    member({ id: 4 }),
                ],
            }),
        );
        expect(plan.skipped.map((s) => [s.d4hMemberId, s.reason])).toEqual([
            [1, "missing-email"],
            [2, "missing-email"],
            [3, "missing-email"],
        ]);
        expect(itemsOf(plan, "add").map((i) => i.d4hMemberId)).toEqual([4]);
        expect(plan.counts).toMatchObject({ skipped: 3, additions: 1 });
    });

    it("skips every unmatched member sharing an email, ignoring case, but keeps updating one matched by id", () => {
        const matched = tm({
            email: "shared@x.com",
            d4h: { d4hMemberId: 1, d4hPosition: "Old" },
        });
        const plan = buildD4HSyncPlan(
            input({
                d4hMembers: [
                    member({ id: 1, email: email("shared@x.com"), position: "New" }),
                    member({ id: 2, email: email("Shared@X.com ") }),
                    member({ id: 3, email: email("SHARED@x.com") }),
                    member({ id: 4, email: email("solo@x.com") }),
                ],
                teamMemberships: [matched],
                existingPersonEmails: new Set(["shared@x.com"]),
            }),
        );
        expect(plan.skipped.map((s) => [s.d4hMemberId, s.reason])).toEqual([
            [2, "duplicate-email"],
            [3, "duplicate-email"],
        ]);
        expect(itemsOf(plan, "update").map((i) => i.teamMembershipId)).toEqual([
            matched.teamMembershipId,
        ]);
        expect(itemsOf(plan, "add").map((i) => i.d4hMemberId)).toEqual([4]);
    });

    it("skips a member whose email belongs to a person in the Rubbish bin (#183)", () => {
        const plan = buildD4HSyncPlan(
            input({
                d4hMembers: [member({ id: 1, email: email("Gone@x.com") })],
                deletedPersonEmails: new Set(["gone@x.com"]),
            }),
        );
        expect(plan.skipped).toEqual([
            expect.objectContaining({ d4hMemberId: 1, reason: "person-in-rubbish-bin" }),
        ]);
        expect(itemsOf(plan, "add")).toHaveLength(0);
    });

    it("skips a member whose person's membership on this team is in the Rubbish bin", () => {
        const plan = buildD4HSyncPlan(
            input({
                d4hMembers: [
                    member({ id: 1, email: email("manual@x.com") }),
                    member({ id: 2, email: email("linked@x.com") }),
                ],
                teamMemberships: [
                    tm({ email: "manual@x.com", status: "Deleted" }),
                    tm({ email: "Linked@x.com", status: "Deleted", d4h: { d4hMemberId: 99 } }),
                ],
                existingPersonEmails: new Set(["manual@x.com", "linked@x.com"]),
            }),
        );
        expect(plan.skipped.map((s) => [s.d4hMemberId, s.reason])).toEqual([
            [1, "membership-in-rubbish-bin"],
            [2, "membership-in-rubbish-bin"],
        ]);
        expect(plan.items.map((i) => i.kind)).toEqual(["metadata"]);
    });
});

describe("buildD4HSyncPlan — relink", () => {
    it("relinks a membership whose D4H member is gone to the new member with its email", () => {
        const old = tm({
            email: "Re@x.com",
            status: "Archived",
            d4h: { d4hMemberId: 10, d4hPosition: "Old" },
        });
        const plan = buildD4HSyncPlan(
            input({
                d4hMembers: [member({ id: 11, email: email("re@x.com"), position: "New" })],
                teamMemberships: [old],
                existingPersonEmails: new Set(["re@x.com"]),
            }),
        );
        expect(itemsOf(plan, "relink")).toEqual([
            expect.objectContaining({
                itemId: `relink:${old.teamMembershipId}`,
                teamMembershipId: old.teamMembershipId,
                personId: old.personId,
                previousD4hMemberId: 10,
                d4hMemberId: 11,
                membershipStatus: "Archived",
                before: expect.objectContaining({ d4hPosition: "Old" }),
                incoming: expect.objectContaining({ d4hPosition: "New" }),
            }),
        ]);
        expect(itemsOf(plan, "add")).toHaveLength(0);
        expect(plan.counts.relinks).toBe(1);
    });

    it("doesn't archive a relinked Active membership", () => {
        const old = tm({ email: "re@x.com", d4h: { d4hMemberId: 10 } });
        const plan = buildD4HSyncPlan(
            input({
                d4hMembers: [member({ id: 11, email: email("re@x.com") })],
                teamMemberships: [old],
            }),
        );
        expect(plan.items.map((i) => i.kind)).toEqual(["relink", "metadata"]);
        expect(plan.counts.archivals).toBe(0);
    });

    it("skips as linked-to-another-member, without relinking, while the old D4H member is still present", () => {
        const old = tm({ email: "re@x.com", d4h: { d4hMemberId: 10 } });
        const plan = buildD4HSyncPlan(
            input({
                d4hMembers: [
                    member({ id: 10, email: email("changed@x.com") }),
                    member({ id: 11, email: email("re@x.com") }),
                ],
                teamMemberships: [old],
                existingPersonEmails: new Set(["re@x.com"]),
            }),
        );
        expect(itemsOf(plan, "relink")).toHaveLength(0);
        expect(itemsOf(plan, "archive")).toHaveLength(0);
        expect(itemsOf(plan, "add")).toHaveLength(0);
        expect(plan.skipped).toEqual([
            expect.objectContaining({ d4hMemberId: 11, reason: "linked-to-another-member" }),
        ]);
        expect(plan.counts.skipped).toBe(1);
    });
});

describe("buildD4HSyncPlan — additions", () => {
    it("new person when the email is unknown", () => {
        const plan = buildD4HSyncPlan(
            input({ d4hMembers: [member({ id: 1, email: email(" New@x.com ") })] }),
        );
        expect(itemsOf(plan, "add")).toEqual([
            expect.objectContaining({
                itemId: "add:1",
                email: "New@x.com",
                personMatch: "new",
                adoptsMembership: false,
                incoming: {
                    d4hStatus: "OPERATIONAL",
                    d4hPosition: null,
                    d4hRef: null,
                    d4hRoleId: null,
                },
            }),
        ]);
    });

    it("existing person when the email already resolves", () => {
        const plan = buildD4HSyncPlan(
            input({
                d4hMembers: [member({ id: 1, email: email("A@x.com") })],
                existingPersonEmails: new Set(["a@x.com"]),
            }),
        );
        expect(itemsOf(plan, "add")[0].personMatch).toBe("existing");
    });

    it("adoptsMembership when an Active or Archived manual membership already joins the person", () => {
        const plan = buildD4HSyncPlan(
            input({
                d4hMembers: [
                    member({ id: 1, email: email("A@X.com") }),
                    member({ id: 2, email: email("b@x.com") }),
                ],
                teamMemberships: [
                    tm({ email: "a@x.com" }),
                    tm({ email: "b@x.com", status: "Archived" }),
                ],
            }),
        );
        expect(itemsOf(plan, "add").map((i) => i.adoptsMembership)).toEqual([true, true]);
    });
});

describe("buildD4HSyncPlan — updates, archival & reactivation", () => {
    it("updates a membership whose snapshot changed, carrying before and incoming", () => {
        const m = tm({ email: "u@x.com", d4h: { d4hMemberId: 1 } });
        const plan = buildD4HSyncPlan(
            input({
                d4hMembers: [member({ id: 1, position: "Lead" })],
                teamMemberships: [m],
            }),
        );
        expect(itemsOf(plan, "update")).toEqual([
            expect.objectContaining({
                itemId: `update:${m.teamMembershipId}`,
                personId: m.personId,
                d4hMemberId: 1,
                before: expect.objectContaining({ d4hPosition: null }),
                incoming: expect.objectContaining({ d4hPosition: "Lead" }),
            }),
        ]);
        expect(plan.counts.updates).toBe(1);
    });

    it("leaves out a membership whose snapshot is unchanged", () => {
        const plan = buildD4HSyncPlan(
            input({
                d4hMembers: [member({ id: 1, position: "Lead" })],
                teamMemberships: [
                    tm({ email: "u@x.com", d4h: { d4hMemberId: 1, d4hPosition: "Lead" } }),
                ],
            }),
        );
        expect(isD4HSyncPlanEmpty(plan)).toBe(true);
    });

    it("archives an active membership no longer in D4H", () => {
        const m = tm({ email: "gone@x.com", d4h: { d4hMemberId: 9 } });
        const plan = buildD4HSyncPlan(input({ teamMemberships: [m] }));
        expect(itemsOf(plan, "archive")).toEqual([
            expect.objectContaining({
                itemId: `archive:${m.teamMembershipId}`,
                personId: m.personId,
                d4hMemberId: 9,
            }),
        ]);
    });

    it("doesn't archive an archived or deleted membership", () => {
        const plan = buildD4HSyncPlan(
            input({
                teamMemberships: [
                    tm({ email: "a@x.com", status: "Archived", d4h: { d4hMemberId: 9 } }),
                    tm({ email: "d@x.com", status: "Deleted", d4h: { d4hMemberId: 8 } }),
                ],
            }),
        );
        expect(isD4HSyncPlanEmpty(plan)).toBe(true);
    });

    it("reactivates an archived membership that reappears in D4H", () => {
        const m = tm({ email: "r@x.com", status: "Archived", d4h: { d4hMemberId: 9 } });
        const plan = buildD4HSyncPlan(
            input({ d4hMembers: [member({ id: 9 })], teamMemberships: [m] }),
        );
        expect(itemsOf(plan, "reactivate")).toEqual([
            expect.objectContaining({ itemId: `reactivate:${m.teamMembershipId}`, d4hMemberId: 9 }),
        ]);
        expect(itemsOf(plan, "update")).toHaveLength(0);
    });
});

describe("buildD4HSyncPlan — metadata, ids & order", () => {
    it("always carries a metadata item, empty when nothing differs", () => {
        const plan = buildD4HSyncPlan(input());
        expect(plan.d4hTeamId).toBe(4242);
        expect(plan.items).toEqual([expect.objectContaining({ itemId: "metadata", changes: [] })]);
        expect(isD4HSyncPlanEmpty(plan)).toBe(true);
    });

    it("carries the stored and incoming team and org fields, with a flat diff", () => {
        const orgBefore = {
            d4hOrganisationName: "Org",
            d4hTimezone: "Pacific/Auckland",
            d4hCurrency: "NZD",
            d4hReportingStartDay: 1,
            d4hReportingStartMonth: 4,
        };
        const orgIncoming = { ...orgBefore, d4hCurrency: "AUD" };
        const plan = buildD4HSyncPlan(
            input({
                metadata: {
                    team: { before: quietTeam, incoming: { ...quietTeam, d4hTeamName: "B" } },
                    organization: { before: orgBefore, incoming: orgIncoming },
                },
            }),
        );
        const [metadata] = itemsOf(plan, "metadata");
        expect(metadata.team.incoming.d4hTeamName).toBe("B");
        expect(metadata.organization).toEqual({ before: orgBefore, incoming: orgIncoming });
        expect(metadata.changes.map((c) => c.path.join("."))).toEqual([
            "d4hTeamName",
            "orgCurrency",
        ]);
        expect(isD4HSyncPlanEmpty(plan)).toBe(false);
    });

    it("gives stable item ids, in execution order, regardless of member order", () => {
        const memberships = [
            tm({ email: "u@x.com", d4h: { d4hMemberId: 1 } }),
            tm({ email: "r@x.com", status: "Archived", d4h: { d4hMemberId: 2 } }),
            tm({ email: "gone@x.com", d4h: { d4hMemberId: 3 } }),
            tm({ email: "re@x.com", d4h: { d4hMemberId: 4 } }),
        ];
        const members = [
            member({ id: 1, position: "Lead" }),
            member({ id: 2 }),
            member({ id: 5, email: email("re@x.com") }),
            member({ id: 6 }),
        ];
        const a = buildD4HSyncPlan(input({ d4hMembers: members, teamMemberships: memberships }));
        const b = buildD4HSyncPlan(
            input({ d4hMembers: [...members].reverse(), teamMemberships: memberships }),
        );
        const [u, r, gone, re] = memberships.map((m) => m.teamMembershipId);
        expect(a.items.map((i) => i.itemId)).toEqual([
            "add:6",
            `relink:${re}`,
            `update:${u}`,
            `reactivate:${r}`,
            `archive:${gone}`,
            "metadata",
        ]);
        expect(b.items.map((i) => i.itemId)).toEqual(a.items.map((i) => i.itemId));
    });

    it("round-trips through the payload schema", () => {
        const plan = buildD4HSyncPlan(
            input({
                d4hMembers: [member({ id: 1 })],
                teamMemberships: [tm({ email: "gone@x.com", d4h: { d4hMemberId: 9 } })],
            }),
        );
        expect(D4HSyncPlan.schema.parse(JSON.parse(JSON.stringify(plan)))).toEqual(plan);
    });
});
