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
