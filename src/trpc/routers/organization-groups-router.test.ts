/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { beforeAll, describe, expect, it } from "vitest";

import { OrganizationId } from "@/lib/schemas/organization";
import { OrganizationGroupId } from "@/lib/schemas/organization-group";
import { UserId } from "@/lib/schemas/user";
import { createMockPrisma } from "@/test/create-prisma-mock";
import { createAuthenticatedMockContext } from "@/test/trpc-helpers";

import { FieldConflictError } from "../errors";

import { organizationGroupsRouter } from "./organization-groups-router";

describe("organizationGroupsRouter", () => {
    // Dataset: a system admin, a plain user, one organization, and one existing group.
    const T = {
        admin: UserId.create(),
        user: UserId.create(),
        org: OrganizationId.create(),
        group: OrganizationGroupId.create(),
    };
    const db = createMockPrisma();

    beforeAll(async () => {
        for (const id of [T.admin, T.user]) {
            await db.user.create({
                data: { id, name: `U-${id}`, email: `${id}@x.test`, emailVerified: true },
            });
        }
        await db.organization.create({
            data: { id: T.org, name: "Alpha", slug: "alpha", createdAt: new Date() },
        });
        await db.organizationGroup.create({
            data: { id: T.group, name: "Existing", slug: "existing" },
        });
    });

    function adminCaller() {
        return organizationGroupsRouter.createCaller(
            createAuthenticatedMockContext({ user: { id: T.admin, role: "admin" }, prisma: db }),
        );
    }

    function userCaller() {
        return organizationGroupsRouter.createCaller(
            createAuthenticatedMockContext({ user: { id: T.user }, prisma: db }),
        );
    }

    it("refuses a non-admin on a query", async () => {
        await expect(userCaller().listGroups()).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("refuses a non-admin on a mutation", async () => {
        await expect(
            userCaller().createGroup({ name: "Nope", slug: "nope" }),
        ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("round-trips create → add member → get for an admin", async () => {
        const caller = adminCaller();

        const created = await caller.createGroup({ name: "Northern", slug: "northern" });
        expect(created.slug).toBe("northern");

        const membership = await caller.addMember({
            groupId: created.id,
            organizationId: T.org,
            role: "Overseer",
        });
        expect(membership).toEqual({
            id: expect.any(String),
            groupId: created.id,
            organizationId: T.org,
        });

        const group = await caller.getGroup({ groupId: created.id });
        expect(group).toMatchObject({ id: created.id, name: "Northern", slug: "northern" });
        expect(group.memberships).toEqual([
            {
                id: membership.id,
                role: "Overseer",
                status: "Active",
                organization: { id: T.org, name: "Alpha", slug: "alpha" },
            },
        ]);
    });

    it("surfaces a duplicate slug as a field conflict on slug", async () => {
        const error = await adminCaller()
            .createGroup({ name: "Another", slug: "existing" })
            .catch((e: unknown) => e);

        expect(error).toMatchObject({ code: "CONFLICT" });
        const cause = (error as { cause?: unknown }).cause;
        expect(cause).toBeInstanceOf(FieldConflictError);
        expect((cause as FieldConflictError).fieldName).toBe("slug");
    });

    it("surfaces an update onto another group's slug as a field conflict on slug", async () => {
        const caller = adminCaller();
        const other = await caller.createGroup({ name: "Southern", slug: "southern" });

        const error = await caller
            .updateGroup({ groupId: other.id, name: "Southern", slug: "existing" })
            .catch((e: unknown) => e);

        expect(error).toMatchObject({ code: "CONFLICT" });
        expect((error as { cause?: unknown }).cause).toBeInstanceOf(FieldConflictError);
    });

    it("lets an update keep the group's own slug", async () => {
        const caller = adminCaller();

        await expect(
            caller.updateGroup({ groupId: T.group, name: "Existing Renamed", slug: "existing" }),
        ).resolves.toEqual({ id: T.group });

        const group = await caller.getGroup({ groupId: T.group });
        expect(group.name).toBe("Existing Renamed");
    });
});
