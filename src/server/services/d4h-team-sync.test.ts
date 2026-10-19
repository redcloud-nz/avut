/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { beforeAll, describe, expect, it, vi } from "vitest";

import { ConflictError } from "@/lib/errors";
import { BatchUpdatePlanId } from "@/lib/schemas/batch-update-plan";
import {
    D4HSyncItem,
    D4HSyncItemDraft,
    D4HSyncItemOutcome,
    D4HSyncPlan,
    isD4HSyncPlanEmpty,
    isSyncPlanEmpty,
} from "@/lib/schemas/d4h-sync-plan";
import { D4HMember } from "@/lib/schemas/d4h/member";
import { OrganizationId } from "@/lib/schemas/organization";
import { PersonId } from "@/lib/schemas/person";
import { TeamId } from "@/lib/schemas/team";
import { TeamMembershipId } from "@/lib/schemas/team-membership";
import { UserId } from "@/lib/schemas/user";
import { createLogBatch } from "@/server/log-entry";
import { createMockPrisma } from "@/test/create-prisma-mock";
import { createOrganizationMockContext } from "@/test/trpc-helpers";

import * as BatchUpdatePlans from "./batch-update-plans";
import {
    buildD4HSyncPlan,
    BuildD4HSyncPlanInput,
    buildSyncPlan,
    BuildSyncPlanInput,
    D4H_TEAM_SYNC_KIND,
    D4HMembershipSnapshot,
    D4HSyncTeamMembershipInput,
    executeD4HSyncPlan,
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

//
// executeD4HSyncPlan — the per-item executor.
//

describe("executeD4HSyncPlan", () => {
    const T = {
        org: OrganizationId.create(),
        /** Its own org, since `Organization_D4H` is one row per org. */
        orgBearing: OrganizationId.create(),
        user: UserId.create(),
    };
    const D4H_TEAM = 4242;
    const db = createMockPrisma();

    beforeAll(async () => {
        for (const id of [T.org, T.orgBearing]) {
            await db.organization.create({
                data: { id, name: id, slug: id, createdAt: new Date() },
            });
        }
        await db.user.create({ data: { id: T.user, name: "Sam Sync", email: "sam@example.com" } });
    });

    function makeCtx(organizationId: OrganizationId = T.org) {
        return createOrganizationMockContext({ organizationId, user: { id: T.user }, prisma: db });
    }

    const snap = (over: Partial<D4HMembershipSnapshot> = {}): D4HMembershipSnapshot => ({
        d4hStatus: "OPERATIONAL",
        d4hPosition: null,
        d4hRef: null,
        d4hRoleId: null,
        ...over,
    });

    /** A fresh D4H-linked team per test, so tests sharing the org never see each other's rows. */
    async function seedTeam(
        over: { status?: "Active" | "Archived"; organizationId?: OrganizationId } = {},
    ): Promise<TeamId> {
        const teamId = TeamId.create();
        await db.team.create({
            data: {
                id: teamId,
                name: `Team ${teamId}`,
                organizationId: over.organizationId ?? T.org,
                status: over.status ?? "Active",
            },
        });
        await db.team_D4H.create({
            data: {
                teamId,
                d4hTeamId: D4H_TEAM,
                d4hTeamName: "A",
                d4hServerCode: "test",
                d4hOrganisationId: null,
                d4hTimezone: null,
            },
        });
        return teamId;
    }

    async function seedPerson(
        email: string,
        status: "Active" | "Deleted" = "Active",
        organizationId: OrganizationId = T.org,
    ): Promise<PersonId> {
        const id = PersonId.create();
        await db.person.create({
            data: { id, organizationId, name: `Person ${email}`, email, status, properties: {} },
        });
        return id;
    }

    async function seedMembership(
        teamId: TeamId,
        personId: PersonId,
        over: {
            status?: "Active" | "Archived" | "Deleted";
            d4h?: (Partial<D4HMembershipSnapshot> & { d4hMemberId: number }) | null;
        } = {},
    ): Promise<TeamMembershipId> {
        const id = TeamMembershipId.create();
        const { d4hMemberId, ...rest } = over.d4h ?? { d4hMemberId: 0 };
        await db.teamMembership.create({
            data: {
                id,
                organizationId: T.org,
                teamId,
                personId,
                status: over.status ?? "Active",
                d4h: over.d4h ? { create: { d4hMemberId, ...snap(rest) } } : undefined,
            },
        });
        return id;
    }

    const quietMetadata = (): Extract<D4HSyncItemDraft, { kind: "metadata" }> => ({
        kind: "metadata",
        itemId: "metadata",
        team: { before: quietTeam, incoming: quietTeam },
        organization: null,
        changes: [],
    });

    /** A plan payload from hand-built items, with a quiet metadata item unless one is given. */
    function payload(items: D4HSyncItemDraft[]): D4HSyncPlan {
        const withMetadata = items.some((i) => i.kind === "metadata")
            ? items
            : [...items, quietMetadata()];
        return D4HSyncPlan.schema.parse({
            d4hTeamId: D4H_TEAM,
            items: withMetadata,
            skipped: [],
            counts: {
                additions: 0,
                relinks: 0,
                updates: 0,
                reactivations: 0,
                archivals: 0,
                skipped: 0,
            },
        });
    }

    async function seedPlan(
        teamId: TeamId,
        items: D4HSyncItemDraft[],
        over: { kind?: string; organizationId?: OrganizationId } = {},
    ): Promise<BatchUpdatePlanId> {
        const plan = await BatchUpdatePlans.create(makeCtx(over.organizationId), {
            kind: over.kind ?? D4H_TEAM_SYNC_KIND,
            targetType: "Team",
            targetId: teamId,
            payload: payload(items),
        });
        return BatchUpdatePlanId.schema.parse(plan.id);
    }

    async function newBatchId(): Promise<string> {
        const batch = await createLogBatch(
            { operationKey: "d4h-team-sync", userId: T.user, description: "Test sync" },
            db,
        );
        return batch.id;
    }

    async function execute(
        planId: BatchUpdatePlanId,
        skipItemIds: string[] = [],
        organizationId: OrganizationId = T.org,
    ) {
        const batchId = await newBatchId();
        const result = await executeD4HSyncPlan(makeCtx(organizationId), {
            planId,
            skipItemIds,
            batchId,
        });
        return { ...result, batchId };
    }

    const outcomeOf = (result: { outcomes: D4HSyncItemOutcome[] }, itemId: string) =>
        result.outcomes.find((o) => o.itemId === itemId);

    const addItem = (d4hMemberId: number, email: string): D4HSyncItemDraft => ({
        kind: "add",
        itemId: `add:${d4hMemberId}`,
        d4hMemberId,
        personName: `Member ${d4hMemberId}`,
        email,
        incoming: snap({ d4hPosition: "Crew" }),
        personMatch: "new",
        adoptsMembership: false,
    });

    describe("add", () => {
        it("creates the person and a linked membership, logged in the batch", async () => {
            const teamId = await seedTeam();
            const planId = await seedPlan(teamId, [addItem(1, "New.Person@x.com")]);

            const result = await execute(planId);

            expect(outcomeOf(result, "add:1")).toEqual({ itemId: "add:1", result: "applied" });
            const person = await db.person.findFirstOrThrow({
                where: { organizationId: T.org, email: "new.person@x.com" },
            });
            const membership = await db.teamMembership.findUniqueOrThrow({
                where: { teamId_personId: { teamId, personId: person.id } },
                include: { d4h: true },
            });
            expect(membership.status).toBe("Active");
            expect(membership.d4h).toMatchObject({ d4hMemberId: 1, d4hPosition: "Crew" });

            const logged = await db.logEntry.findMany({ where: { batchId: result.batchId } });
            expect(logged.map((e) => [e.objectType, e.action])).toEqual(
                expect.arrayContaining([
                    ["Person", "Create"],
                    ["TeamMembership", "Create"],
                ]),
            );
        });

        it("takes over a manual membership of an existing person", async () => {
            const teamId = await seedTeam();
            const personId = await seedPerson("manual@x.com");
            const membershipId = await seedMembership(teamId, personId, { status: "Archived" });
            const planId = await seedPlan(teamId, [addItem(2, "manual@x.com")]);

            const result = await execute(planId);

            expect(outcomeOf(result, "add:2")?.result).toBe("applied");
            const membership = await db.teamMembership.findUniqueOrThrow({
                where: { id: membershipId },
                include: { d4h: true },
            });
            expect(membership.status).toBe("Active");
            expect(membership.d4h?.d4hMemberId).toBe(2);
        });

        it("skips a D4H member already linked on this team", async () => {
            const teamId = await seedTeam();
            const personId = await seedPerson("linked3@x.com");
            await seedMembership(teamId, personId, { d4h: { d4hMemberId: 3 } });
            const planId = await seedPlan(teamId, [addItem(3, "other3@x.com")]);

            const result = await execute(planId);

            expect(outcomeOf(result, "add:3")).toMatchObject({
                result: "skipped-changed",
                reason: "already-linked",
            });
            expect(await db.person.findFirst({ where: { email: "other3@x.com" } })).toBeNull();
        });

        it("skips when the person is in the Rubbish bin", async () => {
            const teamId = await seedTeam();
            await seedPerson("binned@x.com", "Deleted");
            const planId = await seedPlan(teamId, [addItem(4, "binned@x.com")]);

            const result = await execute(planId);

            expect(outcomeOf(result, "add:4")).toMatchObject({
                result: "skipped-changed",
                reason: "person-in-rubbish-bin",
            });
            expect(await db.teamMembership.count({ where: { teamId } })).toBe(0);
        });

        it("skips when the person's membership is linked to another D4H member", async () => {
            const teamId = await seedTeam();
            const personId = await seedPerson("taken@x.com");
            const membershipId = await seedMembership(teamId, personId, {
                d4h: { d4hMemberId: 50 },
            });
            const planId = await seedPlan(teamId, [addItem(5, "taken@x.com")]);

            const result = await execute(planId);

            expect(outcomeOf(result, "add:5")).toMatchObject({
                result: "skipped-changed",
                reason: "linked-to-another-member",
            });
            const d4h = await db.teamMembership_D4H.findUniqueOrThrow({
                where: { teamMembershipId: membershipId },
            });
            expect(d4h.d4hMemberId).toBe(50);
        });

        it("skips when the person's membership is in the Rubbish bin", async () => {
            const teamId = await seedTeam();
            const personId = await seedPerson("tm-binned@x.com");
            const membershipId = await seedMembership(teamId, personId, { status: "Deleted" });
            const planId = await seedPlan(teamId, [addItem(6, "tm-binned@x.com")]);

            const result = await execute(planId);

            expect(outcomeOf(result, "add:6")).toMatchObject({
                result: "skipped-changed",
                reason: "membership-in-rubbish-bin",
            });
            const membership = await db.teamMembership.findUniqueOrThrow({
                where: { id: membershipId },
                include: { d4h: true },
            });
            expect(membership).toMatchObject({ status: "Deleted", d4h: null });
        });
    });

    describe("relink", () => {
        const relinkItem = (
            teamMembershipId: TeamMembershipId,
            personId: PersonId,
            over: Partial<Extract<D4HSyncItemDraft, { kind: "relink" }>> = {},
        ): D4HSyncItemDraft => ({
            kind: "relink",
            itemId: `relink:${teamMembershipId}`,
            teamMembershipId,
            personId,
            personName: "Re",
            previousD4hMemberId: 10,
            d4hMemberId: 11,
            membershipStatus: "Archived",
            before: snap(),
            incoming: snap({ d4hPosition: "New" }),
            changes: [],
            ...over,
        });

        it("rewrites the D4H member id and details, reactivating an archived membership", async () => {
            const teamId = await seedTeam();
            const personId = await seedPerson("re@x.com");
            const membershipId = await seedMembership(teamId, personId, {
                status: "Archived",
                d4h: { d4hMemberId: 10 },
            });
            const planId = await seedPlan(teamId, [relinkItem(membershipId, personId)]);

            const result = await execute(planId);

            expect(outcomeOf(result, `relink:${membershipId}`)?.result).toBe("applied");
            const membership = await db.teamMembership.findUniqueOrThrow({
                where: { id: membershipId },
                include: { d4h: true },
            });
            expect(membership.status).toBe("Active");
            expect(membership.d4h).toMatchObject({ d4hMemberId: 11, d4hPosition: "New" });
        });

        it("skips when the membership is no longer linked to the previous member", async () => {
            const teamId = await seedTeam();
            const personId = await seedPerson("re2@x.com");
            const membershipId = await seedMembership(teamId, personId, {
                d4h: { d4hMemberId: 12 },
            });
            const planId = await seedPlan(teamId, [relinkItem(membershipId, personId)]);

            const result = await execute(planId);

            expect(outcomeOf(result, `relink:${membershipId}`)).toMatchObject({
                result: "skipped-changed",
                reason: "d4h-member-changed",
            });
        });

        it("skips when another membership on the team is linked to the new member", async () => {
            const teamId = await seedTeam();
            const personId = await seedPerson("re3@x.com");
            const membershipId = await seedMembership(teamId, personId, {
                d4h: { d4hMemberId: 10 },
            });
            await seedMembership(teamId, await seedPerson("holder@x.com"), {
                d4h: { d4hMemberId: 11 },
            });
            const planId = await seedPlan(teamId, [relinkItem(membershipId, personId)]);

            const result = await execute(planId);

            expect(outcomeOf(result, `relink:${membershipId}`)).toMatchObject({
                result: "skipped-changed",
                reason: "already-linked",
            });
            const d4h = await db.teamMembership_D4H.findUniqueOrThrow({
                where: { teamMembershipId: membershipId },
            });
            expect(d4h.d4hMemberId).toBe(10);
        });
    });

    describe("update", () => {
        const updateItem = (
            teamMembershipId: TeamMembershipId,
            personId: PersonId,
            d4hMemberId: number,
        ): D4HSyncItemDraft => ({
            kind: "update",
            itemId: `update:${teamMembershipId}`,
            teamMembershipId,
            personId,
            personName: "U",
            d4hMemberId,
            before: snap({ d4hPosition: "Old" }),
            incoming: snap({ d4hPosition: "Lead" }),
            changes: [],
        });

        it("writes the incoming details and logs them", async () => {
            const teamId = await seedTeam();
            const personId = await seedPerson("u1@x.com");
            const membershipId = await seedMembership(teamId, personId, {
                d4h: { d4hMemberId: 20, d4hPosition: "Old" },
            });
            const planId = await seedPlan(teamId, [updateItem(membershipId, personId, 20)]);

            const result = await execute(planId);

            expect(outcomeOf(result, `update:${membershipId}`)?.result).toBe("applied");
            const d4h = await db.teamMembership_D4H.findUniqueOrThrow({
                where: { teamMembershipId: membershipId },
            });
            expect(d4h.d4hPosition).toBe("Lead");
            const logged = await db.logEntry.findMany({
                where: { batchId: result.batchId, objectId: membershipId },
            });
            expect(logged).toHaveLength(1);
        });

        it("skips when the stored details no longer equal the plan's before", async () => {
            const teamId = await seedTeam();
            const personId = await seedPerson("u2@x.com");
            const membershipId = await seedMembership(teamId, personId, {
                d4h: { d4hMemberId: 21, d4hPosition: "Edited" },
            });
            const planId = await seedPlan(teamId, [updateItem(membershipId, personId, 21)]);

            const result = await execute(planId);

            expect(outcomeOf(result, `update:${membershipId}`)).toMatchObject({
                result: "skipped-changed",
                reason: "details-changed",
            });
            const d4h = await db.teamMembership_D4H.findUniqueOrThrow({
                where: { teamMembershipId: membershipId },
            });
            expect(d4h.d4hPosition).toBe("Edited");
        });

        it("skips when the membership is linked to a different D4H member", async () => {
            const teamId = await seedTeam();
            const personId = await seedPerson("u3@x.com");
            const membershipId = await seedMembership(teamId, personId, {
                d4h: { d4hMemberId: 99, d4hPosition: "Old" },
            });
            const planId = await seedPlan(teamId, [updateItem(membershipId, personId, 22)]);

            const result = await execute(planId);

            expect(outcomeOf(result, `update:${membershipId}`)).toMatchObject({
                result: "skipped-changed",
                reason: "d4h-member-changed",
            });
        });

        it("skips when the membership is in the Rubbish bin", async () => {
            const teamId = await seedTeam();
            const personId = await seedPerson("u4@x.com");
            const membershipId = await seedMembership(teamId, personId, {
                status: "Deleted",
                d4h: { d4hMemberId: 23, d4hPosition: "Old" },
            });
            const planId = await seedPlan(teamId, [updateItem(membershipId, personId, 23)]);

            const result = await execute(planId);

            expect(outcomeOf(result, `update:${membershipId}`)).toMatchObject({
                result: "skipped-changed",
                reason: "membership-in-rubbish-bin",
            });
        });
    });

    describe("reactivate and archive", () => {
        const reactivateItem = (
            teamMembershipId: TeamMembershipId,
            personId: PersonId,
        ): D4HSyncItemDraft => ({
            kind: "reactivate",
            itemId: `reactivate:${teamMembershipId}`,
            teamMembershipId,
            personId,
            personName: "R",
            d4hMemberId: 30,
            incoming: snap({ d4hRef: "R1" }),
            changes: [],
        });
        const archiveItem = (
            teamMembershipId: TeamMembershipId,
            personId: PersonId,
        ): D4HSyncItemDraft => ({
            kind: "archive",
            itemId: `archive:${teamMembershipId}`,
            teamMembershipId,
            personId,
            personName: "A",
            d4hMemberId: 40,
        });

        it("reactivates a still-archived membership with the incoming details", async () => {
            const teamId = await seedTeam();
            const personId = await seedPerson("r1@x.com");
            const membershipId = await seedMembership(teamId, personId, {
                status: "Archived",
                d4h: { d4hMemberId: 30 },
            });
            const planId = await seedPlan(teamId, [reactivateItem(membershipId, personId)]);

            const result = await execute(planId);

            expect(outcomeOf(result, `reactivate:${membershipId}`)?.result).toBe("applied");
            const membership = await db.teamMembership.findUniqueOrThrow({
                where: { id: membershipId },
                include: { d4h: true },
            });
            expect(membership.status).toBe("Active");
            expect(membership.d4h?.d4hRef).toBe("R1");
        });

        it("skips a reactivation once the membership is no longer archived", async () => {
            const teamId = await seedTeam();
            const personId = await seedPerson("r2@x.com");
            const membershipId = await seedMembership(teamId, personId, {
                d4h: { d4hMemberId: 30 },
            });
            const planId = await seedPlan(teamId, [reactivateItem(membershipId, personId)]);

            const result = await execute(planId);

            expect(outcomeOf(result, `reactivate:${membershipId}`)).toMatchObject({
                result: "skipped-changed",
                reason: "not-archived",
            });
        });

        it("archives a still-active membership", async () => {
            const teamId = await seedTeam();
            const personId = await seedPerson("a1@x.com");
            const membershipId = await seedMembership(teamId, personId, {
                d4h: { d4hMemberId: 40 },
            });
            const planId = await seedPlan(teamId, [archiveItem(membershipId, personId)]);

            const result = await execute(planId);

            expect(outcomeOf(result, `archive:${membershipId}`)?.result).toBe("applied");
            const membership = await db.teamMembership.findUniqueOrThrow({
                where: { id: membershipId },
            });
            expect(membership.status).toBe("Archived");
        });

        it("skips an archival once the membership is no longer active", async () => {
            const teamId = await seedTeam();
            const personId = await seedPerson("a2@x.com");
            const membershipId = await seedMembership(teamId, personId, {
                status: "Deleted",
                d4h: { d4hMemberId: 40 },
            });
            const planId = await seedPlan(teamId, [archiveItem(membershipId, personId)]);

            const result = await execute(planId);

            expect(outcomeOf(result, `archive:${membershipId}`)).toMatchObject({
                result: "skipped-changed",
                reason: "not-active",
            });
        });
    });

    describe("metadata", () => {
        it("writes fields still equal to before, and leaves changed ones alone", async () => {
            const teamId = await seedTeam();
            await db.team_D4H.update({ where: { teamId }, data: { d4hTimezone: "Edited/Zone" } });
            const planId = await seedPlan(teamId, [
                {
                    ...quietMetadata(),
                    team: {
                        before: quietTeam,
                        incoming: { ...quietTeam, d4hTeamName: "B", d4hTimezone: "Pacific/X" },
                    },
                },
            ]);

            const result = await execute(planId);

            expect(outcomeOf(result, "metadata")).toEqual({
                itemId: "metadata",
                result: "applied",
                skippedFields: ["d4hTimezone"],
            });
            const row = await db.team_D4H.findUniqueOrThrow({ where: { teamId } });
            expect(row).toMatchObject({ d4hTeamName: "B", d4hTimezone: "Edited/Zone" });
        });

        it("skips the item when every changed field moved under the plan", async () => {
            const teamId = await seedTeam();
            await db.team_D4H.update({ where: { teamId }, data: { d4hTeamName: "Renamed" } });
            const planId = await seedPlan(teamId, [
                {
                    ...quietMetadata(),
                    team: { before: quietTeam, incoming: { ...quietTeam, d4hTeamName: "B" } },
                },
            ]);

            const result = await execute(planId);

            expect(outcomeOf(result, "metadata")).toEqual({
                itemId: "metadata",
                result: "skipped-changed",
                reason: "fields-changed",
                skippedFields: ["d4hTeamName"],
            });
            const row = await db.team_D4H.findUniqueOrThrow({ where: { teamId } });
            expect(row.d4hTeamName).toBe("Renamed");
        });

        it("gates org fields too, and sets the org's lastSyncedAt", async () => {
            const teamId = await seedTeam({ organizationId: T.orgBearing });
            const orgBefore = {
                d4hOrganisationName: "Org",
                d4hTimezone: "Pacific/Auckland",
                d4hCurrency: "NZD",
                d4hReportingStartDay: 1,
                d4hReportingStartMonth: 4,
            };
            await db.organization_D4H.create({
                data: {
                    organizationId: T.orgBearing,
                    serverCode: "test",
                    d4hOrganisationId: 7,
                    ...orgBefore,
                    d4hCurrency: "EUR",
                },
            });
            const planId = await seedPlan(
                teamId,
                [
                    {
                        ...quietMetadata(),
                        organization: {
                            before: orgBefore,
                            incoming: {
                                ...orgBefore,
                                d4hOrganisationName: "Org 2",
                                d4hCurrency: "AUD",
                            },
                        },
                    },
                ],
                { organizationId: T.orgBearing },
            );

            const result = await execute(planId, [], T.orgBearing);

            expect(outcomeOf(result, "metadata")).toMatchObject({
                result: "applied",
                skippedFields: ["orgCurrency"],
            });
            const orgRow = await db.organization_D4H.findUniqueOrThrow({
                where: { organizationId: T.orgBearing },
            });
            const plan = await db.batchUpdatePlan.findUniqueOrThrow({ where: { id: planId } });
            expect(orgRow).toMatchObject({
                d4hOrganisationName: "Org 2",
                d4hCurrency: "EUR",
                lastSyncedAt: plan.createdAt,
            });
        });
    });

    describe("the plan's lifecycle", () => {
        it("runs items in execution order, completes, and stores outcomes and logBatchId", async () => {
            const teamId = await seedTeam();
            const personId = await seedPerson("order@x.com");
            const membershipId = await seedMembership(teamId, personId, {
                d4h: { d4hMemberId: 60 },
            });
            const archive: D4HSyncItemDraft = {
                kind: "archive",
                itemId: `archive:${membershipId}`,
                teamMembershipId: membershipId,
                personId,
                personName: "O",
                d4hMemberId: 60,
            };
            // Listed out of order: the executor still runs adds first.
            const planId = await seedPlan(teamId, [archive, addItem(61, "order-new@x.com")]);

            const result = await execute(planId);

            expect(result.outcomes.map((o) => o.itemId)).toEqual([
                "add:61",
                `archive:${membershipId}`,
                "metadata",
            ]);
            expect(result.plan).toMatchObject({ id: planId, teamId });
            const plan = await db.batchUpdatePlan.findUniqueOrThrow({ where: { id: planId } });
            expect(plan).toMatchObject({
                status: "Completed",
                logBatchId: result.batchId,
                outcomes: result.outcomes,
            });
            const teamD4H = await db.team_D4H.findUniqueOrThrow({ where: { teamId } });
            expect(teamD4H.lastSyncedAt).toEqual(plan.createdAt);
        });

        it("writes nothing for an item the user skipped", async () => {
            const teamId = await seedTeam();
            const personId = await seedPerson("skip@x.com");
            const membershipId = await seedMembership(teamId, personId, {
                d4h: { d4hMemberId: 70 },
            });
            const planId = await seedPlan(teamId, [
                addItem(71, "skip-new@x.com"),
                {
                    kind: "archive",
                    itemId: `archive:${membershipId}`,
                    teamMembershipId: membershipId,
                    personId,
                    personName: "S",
                    d4hMemberId: 70,
                },
            ]);

            const result = await execute(planId, ["add:71", `archive:${membershipId}`]);

            expect(result.outcomes.map((o) => o.result)).toEqual([
                "skipped-by-user",
                "skipped-by-user",
                "applied",
            ]);
            expect(await db.person.findFirst({ where: { email: "skip-new@x.com" } })).toBeNull();
            const membership = await db.teamMembership.findUniqueOrThrow({
                where: { id: membershipId },
            });
            expect(membership.status).toBe("Active");
            expect(await db.logEntry.count({ where: { batchId: result.batchId } })).toBe(0);
        });

        it("refuses a second execute of the same plan", async () => {
            const teamId = await seedTeam();
            const planId = await seedPlan(teamId, []);
            await execute(planId);

            await expect(execute(planId)).rejects.toBeInstanceOf(ConflictError);
        });

        it("refuses a plan whose team is now linked to a different D4H team", async () => {
            const teamId = await seedTeam();
            const planId = await seedPlan(teamId, []);
            await db.team_D4H.update({ where: { teamId }, data: { d4hTeamId: D4H_TEAM + 1 } });

            await expect(execute(planId)).rejects.toThrow(/no longer linked/);
            const plan = await db.batchUpdatePlan.findUniqueOrThrow({ where: { id: planId } });
            expect(plan.status).toBe("Pending");
        });

        it("refuses a plan whose team is archived, or a plan of another kind", async () => {
            const archivedTeam = await seedTeam({ status: "Archived" });
            const archivedPlan = await seedPlan(archivedTeam, []);
            await expect(execute(archivedPlan)).rejects.toBeInstanceOf(ConflictError);

            const otherKind = await seedPlan(await seedTeam(), [], {
                kind: "skill-package-import",
            });
            await expect(execute(otherKind)).rejects.toThrow(/isn't a D4H team sync/);
        });

        it("on an unexpected error, fails the plan with the outcomes so far and rethrows", async () => {
            const teamId = await seedTeam();
            const personId = await seedPerson("boom@x.com");
            const ids = [
                await seedMembership(teamId, personId, { d4h: { d4hMemberId: 80 } }),
                await seedMembership(teamId, await seedPerson("boom2@x.com"), {
                    d4h: { d4hMemberId: 81 },
                }),
            ];
            const planId = await seedPlan(
                teamId,
                ids.map((id, i) => ({
                    kind: "archive" as const,
                    itemId: `archive:${id}`,
                    teamMembershipId: id,
                    personId,
                    personName: `B${i}`,
                    d4hMemberId: 80 + i,
                })),
            );

            const original = db.$transaction.bind(db);
            let calls = 0;
            const spy = vi.spyOn(db, "$transaction").mockImplementation(((arg: never) => {
                calls += 1;
                if (calls === 2) return Promise.reject(new Error("boom"));
                return original(arg);
            }) as typeof db.$transaction);
            try {
                await expect(execute(planId)).rejects.toThrow("boom");
            } finally {
                spy.mockRestore();
            }

            const plan = await db.batchUpdatePlan.findUniqueOrThrow({ where: { id: planId } });
            expect(plan.status).toBe("Failed");
            expect(plan.outcomes).toEqual([{ itemId: `archive:${ids[0]}`, result: "applied" }]);
            const teamD4H = await db.team_D4H.findUniqueOrThrow({ where: { teamId } });
            expect(teamD4H.lastSyncedAt).toBeNull();
        });
    });
});
