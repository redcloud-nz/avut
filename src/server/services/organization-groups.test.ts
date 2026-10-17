/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { beforeAll, describe, expect, it } from "vitest";

import { ConflictError } from "@/lib/errors";
import { OrganizationId } from "@/lib/schemas/organization";
import {
    OrganizationGroupId,
    OrganizationGroupMembershipId,
} from "@/lib/schemas/organization-group";
import { UserId } from "@/lib/schemas/user";
import { recordLogEntry } from "@/server/log-entry";
import { createMockPrisma } from "@/test/create-prisma-mock";

import * as OrganizationGroups from "./organization-groups";
import type { SystemServiceContext } from "./service-context";

describe("OrganizationGroups: groups", () => {
    const T = {
        admin: UserId.create(),
        orgA: OrganizationId.create(),
        orgB: OrganizationId.create(),
        orgC: OrganizationId.create(),
        /** Active overseer A, active member B, revoked overseer C. */
        busy: OrganizationGroupId.create(),
        /** Only a revoked membership (C). */
        lapsed: OrganizationGroupId.create(),
        lapsedMembership: OrganizationGroupMembershipId.create(),
    };

    const db = createMockPrisma();
    const actor = { userId: T.admin };

    const ctx: SystemServiceContext = {
        prisma: db,
        logSystemEvent: (options, tx = db) =>
            recordLogEntry({ scope: "system", actor, actorLabel: "Admin", ...options }, tx),
    };

    async function entriesFor(objectId: string) {
        return db.logEntry.findMany({ where: { objectType: "OrganizationGroup", objectId } });
    }

    beforeAll(async () => {
        await db.user.create({
            data: { id: T.admin, name: "Admin", email: "admin@example.com", role: "admin" },
        });
        for (const [id, name] of [
            [T.orgA, "Alpha SAR"],
            [T.orgB, "Bravo SAR"],
            [T.orgC, "CC"],
        ] as const) {
            await db.organization.create({ data: { id, name, slug: id, createdAt: new Date() } });
        }
        await db.organizationGroup.create({
            data: { id: T.busy, name: "Busy Group", slug: "busy" },
        });
        await db.organizationGroup.create({
            data: { id: T.lapsed, name: "Lapsed Group", slug: "lapsed" },
        });
        for (const [id, groupId, organizationId, role, status] of [
            [OrganizationGroupMembershipId.create(), T.busy, T.orgA, "Overseer", "Active"],
            [OrganizationGroupMembershipId.create(), T.busy, T.orgB, "Member", "Active"],
            [OrganizationGroupMembershipId.create(), T.busy, T.orgC, "Overseer", "Revoked"],
            [T.lapsedMembership, T.lapsed, T.orgC, "Overseer", "Revoked"],
        ] as const) {
            await db.organizationGroupMembership.create({
                data: { id, groupId, organizationId, role, status },
            });
        }
    });

    it("lists groups with active member counts and the active overseer only", async () => {
        const groups = await OrganizationGroups.listGroups(ctx);
        const busy = groups.find((g) => g.id === T.busy);
        const lapsed = groups.find((g) => g.id === T.lapsed);

        expect(busy).toMatchObject({
            activeMemberCount: 2,
            overseer: { id: T.orgA, name: "Alpha SAR", slug: T.orgA },
        });
        expect(lapsed).toMatchObject({ activeMemberCount: 0, overseer: null });
    });

    it("returns every membership, any status, on the group detail", async () => {
        const detail = await OrganizationGroups.getGroupDetail(ctx, T.busy);
        expect(detail.memberships).toHaveLength(3);
        expect(detail.memberships.find((m) => m.organization.id === T.orgC)).toMatchObject({
            role: "Overseer",
            status: "Revoked",
            organization: { name: "CC" },
        });
    });

    it("creates a group and logs one system-scoped Create", async () => {
        const { id, slug } = await OrganizationGroups.createGroup(ctx, {
            name: "New Group",
            slug: "new-group",
        });

        expect(slug).toBe("new-group");
        expect(await OrganizationGroups.getGroupBySlug(ctx, "new-group")).toMatchObject({ id });
        const entries = await entriesFor(id);
        expect(entries).toHaveLength(1);
        expect(entries[0]).toMatchObject({
            scope: "system",
            action: "Create",
            organizationId: null,
            ownerId: null,
        });
    });

    it("refuses to create a group with a taken slug", async () => {
        await expect(
            OrganizationGroups.createGroup(ctx, { name: "Another", slug: "busy" }),
        ).rejects.toThrow(ConflictError);
    });

    it("updates a group, logging the diff", async () => {
        const { id } = await OrganizationGroups.createGroup(ctx, {
            name: "Rename Me",
            slug: "rename-me",
        });

        await OrganizationGroups.updateGroup(ctx, {
            groupId: id,
            name: "Renamed",
            slug: "renamed",
        });

        expect(await OrganizationGroups.requireGroupById(ctx, id)).toMatchObject({
            name: "Renamed",
            slug: "renamed",
        });
        const updates = (await entriesFor(id)).filter((e) => e.action === "Update");
        expect(updates).toHaveLength(1);
        expect(updates[0]).toMatchObject({ scope: "system" });
        expect(updates[0].changes).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ path: ["name"], prev: "Rename Me", curr: "Renamed" }),
                expect.objectContaining({ path: ["slug"], prev: "rename-me", curr: "renamed" }),
            ]),
        );
    });

    it("lets an update keep the group's own slug", async () => {
        const { id } = await OrganizationGroups.createGroup(ctx, {
            name: "Keep Slug",
            slug: "keep-slug",
        });

        await OrganizationGroups.updateGroup(ctx, {
            groupId: id,
            name: "Keep Slug Renamed",
            slug: "keep-slug",
        });

        expect((await OrganizationGroups.requireGroupById(ctx, id)).name).toBe("Keep Slug Renamed");
    });

    it("writes no log entry for an update that changes nothing", async () => {
        const { id } = await OrganizationGroups.createGroup(ctx, {
            name: "Unchanged",
            slug: "unchanged",
        });

        await OrganizationGroups.updateGroup(ctx, {
            groupId: id,
            name: "Unchanged",
            slug: "unchanged",
        });

        expect((await entriesFor(id)).filter((e) => e.action === "Update")).toHaveLength(0);
    });

    it("refuses an update onto another group's slug", async () => {
        await expect(
            OrganizationGroups.updateGroup(ctx, {
                groupId: T.lapsed,
                name: "Lapsed",
                slug: "busy",
            }),
        ).rejects.toThrow(ConflictError);
    });

    it("refuses to delete a group with an active member", async () => {
        await expect(OrganizationGroups.deleteGroup(ctx, T.busy)).rejects.toThrow(
            /Revoke its members first/,
        );
        expect(await db.organizationGroup.findUnique({ where: { id: T.busy } })).not.toBeNull();
        expect(await entriesFor(T.busy)).toHaveLength(0);
    });

    it("deletes a group with only revoked members, and its rows with it", async () => {
        await OrganizationGroups.deleteGroup(ctx, T.lapsed);

        expect(await db.organizationGroup.findUnique({ where: { id: T.lapsed } })).toBeNull();
        expect(
            await db.organizationGroupMembership.findUnique({ where: { id: T.lapsedMembership } }),
        ).toBeNull();
        const entries = await entriesFor(T.lapsed);
        expect(entries).toHaveLength(1);
        expect(entries[0]).toMatchObject({ scope: "system", action: "Delete" });
        expect(entries[0].description).toContain("Lapsed Group");
    });
});

describe("OrganizationGroups: memberships", () => {
    const T = {
        admin: UserId.create(),
        orgA: OrganizationId.create(),
        orgB: OrganizationId.create(),
        orgC: OrganizationId.create(),
        orgD: OrganizationId.create(),
        orgE: OrganizationId.create(),
        orgF: OrganizationId.create(),
        orgG: OrganizationId.create(),
        /** Active overseer A, active member B, revoked member C. */
        main: OrganizationGroupId.create(),
        mainA: OrganizationGroupMembershipId.create(),
        mainB: OrganizationGroupMembershipId.create(),
        mainC: OrganizationGroupMembershipId.create(),
        /** Only a revoked overseer (D). */
        lapsed: OrganizationGroupId.create(),
        /** Active overseer E, active members F and G. */
        rotate: OrganizationGroupId.create(),
        rotateE: OrganizationGroupMembershipId.create(),
        rotateF: OrganizationGroupMembershipId.create(),
        rotateG: OrganizationGroupMembershipId.create(),
    };

    const db = createMockPrisma();
    const actor = { userId: T.admin };

    const ctx: SystemServiceContext = {
        prisma: db,
        logSystemEvent: (options, tx = db) =>
            recordLogEntry({ scope: "system", actor, actorLabel: "Admin", ...options }, tx),
    };

    async function entriesFor(objectId: string) {
        return db.logEntry.findMany({
            where: { objectType: "OrganizationGroupMembership", objectId },
        });
    }

    async function contextRefsOf(logEntryId: string) {
        return db.logEntryObject.findMany({ where: { logEntryId, role: "context" } });
    }

    beforeAll(async () => {
        await db.user.create({
            data: { id: T.admin, name: "Admin", email: "admin@example.com", role: "admin" },
        });
        for (const [id, name] of [
            [T.orgA, "Alpha SAR"],
            [T.orgB, "Bravo SAR"],
            [T.orgC, "Charlie SAR"],
            [T.orgD, "Delta SAR"],
            [T.orgE, "Echo SAR"],
            [T.orgF, "Foxtrot SAR"],
            [T.orgG, "Golf SAR"],
        ] as const) {
            await db.organization.create({ data: { id, name, slug: id, createdAt: new Date() } });
        }
        for (const [id, name, slug] of [
            [T.main, "Main Group", "main"],
            [T.lapsed, "Lapsed Group", "lapsed"],
            [T.rotate, "Rotate Group", "rotate"],
        ] as const) {
            await db.organizationGroup.create({ data: { id, name, slug } });
        }
        for (const [id, groupId, organizationId, role, status] of [
            [T.mainA, T.main, T.orgA, "Overseer", "Active"],
            [T.mainB, T.main, T.orgB, "Member", "Active"],
            [T.mainC, T.main, T.orgC, "Member", "Revoked"],
            [OrganizationGroupMembershipId.create(), T.lapsed, T.orgD, "Overseer", "Revoked"],
            [T.rotateE, T.rotate, T.orgE, "Overseer", "Active"],
            [T.rotateF, T.rotate, T.orgF, "Member", "Active"],
            [T.rotateG, T.rotate, T.orgG, "Member", "Active"],
        ] as const) {
            await db.organizationGroupMembership.create({
                data: { id, groupId, organizationId, role, status },
            });
        }
    });

    it("adds a member, logging one system-scoped Create that refs the org and group", async () => {
        const result = await OrganizationGroups.addMember(ctx, {
            groupId: T.main,
            organizationId: T.orgD,
            role: "Member",
        });

        expect(result).toMatchObject({ groupId: T.main, organizationId: T.orgD });
        expect(await OrganizationGroups.requireMembershipById(ctx, result.id)).toMatchObject({
            role: "Member",
            status: "Active",
        });
        const entries = await entriesFor(result.id);
        expect(entries).toHaveLength(1);
        expect(entries[0]).toMatchObject({
            scope: "system",
            action: "Create",
            organizationId: null,
            ownerId: null,
        });
        expect(entries[0].description).toContain("Delta SAR");
        expect(entries[0].description).toContain("Main Group");
        expect(await contextRefsOf(entries[0].id)).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ objectType: "Organization", objectId: T.orgD }),
                expect.objectContaining({ objectType: "OrganizationGroup", objectId: T.main }),
            ]),
        );
    });

    it("refuses to add an organization that is already an active member", async () => {
        await expect(
            OrganizationGroups.addMember(ctx, {
                groupId: T.main,
                organizationId: T.orgB,
                role: "Member",
            }),
        ).rejects.toThrow(ConflictError);
        expect(await entriesFor(T.mainB)).toHaveLength(0);
    });

    it("refuses a second active overseer via addMember", async () => {
        await expect(
            OrganizationGroups.addMember(ctx, {
                groupId: T.main,
                organizationId: T.orgF,
                role: "Overseer",
            }),
        ).rejects.toThrow(/already has an overseer/);
        expect(
            await db.organizationGroupMembership.findFirst({
                where: { groupId: T.main, organizationId: T.orgF },
            }),
        ).toBeNull();
    });

    it("refuses a second active overseer via setMemberRole", async () => {
        await expect(
            OrganizationGroups.setMemberRole(ctx, { membershipId: T.mainB, role: "Overseer" }),
        ).rejects.toThrow(/already has an overseer/);
        expect((await OrganizationGroups.requireMembershipById(ctx, T.mainB)).role).toBe("Member");
    });

    it("doesn't let a revoked overseer block a new one", async () => {
        const { id } = await OrganizationGroups.addMember(ctx, {
            groupId: T.lapsed,
            organizationId: T.orgA,
            role: "Overseer",
        });

        expect(await OrganizationGroups.requireMembershipById(ctx, id)).toMatchObject({
            role: "Overseer",
            status: "Active",
        });
    });

    it("lets the overseer be demoted and another member promoted", async () => {
        await OrganizationGroups.setMemberRole(ctx, { membershipId: T.rotateE, role: "Member" });
        await OrganizationGroups.setMemberRole(ctx, { membershipId: T.rotateF, role: "Overseer" });

        const groups = await OrganizationGroups.listGroups(ctx);
        expect(groups.find((g) => g.id === T.rotate)?.overseer).toMatchObject({ id: T.orgF });

        const entries = await entriesFor(T.rotateF);
        expect(entries).toHaveLength(1);
        expect(entries[0]).toMatchObject({ scope: "system", action: "Update" });
        expect(entries[0].changes).toEqual([
            expect.objectContaining({ path: ["role"], prev: "Member", curr: "Overseer" }),
        ]);
        expect(await contextRefsOf(entries[0].id)).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ objectType: "Organization", objectId: T.orgF }),
            ]),
        );
    });

    it("treats setting the current role as a no-op, with no log entry", async () => {
        const result = await OrganizationGroups.setMemberRole(ctx, {
            membershipId: T.mainB,
            role: "Member",
        });

        expect(result).toEqual({ id: T.mainB, groupId: T.main, organizationId: T.orgB });
        expect(await entriesFor(T.mainB)).toHaveLength(0);
    });

    it("refuses to revoke or change the role of a revoked membership", async () => {
        await expect(OrganizationGroups.revokeMember(ctx, T.mainC)).rejects.toThrow(ConflictError);
        await expect(
            OrganizationGroups.setMemberRole(ctx, { membershipId: T.mainC, role: "Overseer" }),
        ).rejects.toThrow(ConflictError);
        expect(await entriesFor(T.mainC)).toHaveLength(0);
    });

    it("revokes a membership, and re-adding reuses the same row", async () => {
        const revoked = await OrganizationGroups.revokeMember(ctx, T.rotateG);
        expect(revoked).toEqual({ id: T.rotateG, groupId: T.rotate, organizationId: T.orgG });
        expect((await OrganizationGroups.requireMembershipById(ctx, T.rotateG)).status).toBe(
            "Revoked",
        );

        const readded = await OrganizationGroups.addMember(ctx, {
            groupId: T.rotate,
            organizationId: T.orgG,
            role: "Member",
        });
        expect(readded.id).toBe(T.rotateG);
        expect((await OrganizationGroups.requireMembershipById(ctx, T.rotateG)).status).toBe(
            "Active",
        );

        const entries = await entriesFor(T.rotateG);
        expect(entries).toHaveLength(2);
        expect(entries.map((e) => [e.scope, e.action])).toEqual(
            expect.arrayContaining([
                ["system", "Revoke"],
                ["system", "Update"],
            ]),
        );
        for (const entry of entries) {
            expect(await contextRefsOf(entry.id)).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ objectType: "Organization", objectId: T.orgG }),
                ]),
            );
        }
    });

    it("lists an organization's memberships of any status, with the group ref", async () => {
        expect(await OrganizationGroups.listGroupsForOrganization(ctx, T.orgC)).toEqual([
            {
                id: T.mainC,
                role: "Member",
                status: "Revoked",
                group: { id: T.main, name: "Main Group" },
            },
        ]);
    });
});
