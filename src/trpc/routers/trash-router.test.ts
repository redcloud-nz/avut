/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { beforeAll, describe, expect, it, vi } from "vitest";

import { nanoId16 } from "@/lib/id";
import { OrganizationId } from "@/lib/schemas/organization";
import { PersonId } from "@/lib/schemas/person";
import { TeamId } from "@/lib/schemas/team";
import { UserId } from "@/lib/schemas/user";
import { createMockPrisma } from "@/test/create-prisma-mock";
import { createAuthenticatedMockContext } from "@/test/trpc-helpers";

import { trashRouter } from "./trash-router";

// The router reaches server-only modules at import time. The procedures exercised here use
// ctx.prisma (the injected mock), so an empty stub is enough to let them import in jsdom.
vi.mock("server-only", () => ({}));

describe("trash.listTrash", () => {
    const T = {
        org: OrganizationId.create(),
        adminUser: UserId.create(),
        personOnlyUser: UserId.create(),
        outsiderUser: UserId.create(),
        deletedPerson: PersonId.create(),
        activePerson: PersonId.create(),
        deletedTeam: TeamId.create(),
    };

    const db = createMockPrisma();

    beforeAll(async () => {
        await db.organization.create({
            data: { id: T.org, name: "Acme", slug: "acme", createdAt: new Date() },
        });

        await db.person.create({
            data: {
                id: T.deletedPerson,
                organizationId: T.org,
                name: "Grace Hopper",
                email: "grace-trash@example.com",
                tags: [],
                properties: {},
                status: "Deleted",
            },
        });
        await db.person.create({
            data: {
                id: T.activePerson,
                organizationId: T.org,
                name: "Ada Lovelace",
                email: "ada-trash@example.com",
                tags: [],
                properties: {},
                status: "Active",
            },
        });
        await db.team.create({
            data: {
                id: T.deletedTeam,
                organizationId: T.org,
                name: "Doomed Team",
                tags: [],
                properties: {},
                status: "Deleted",
            },
        });

        await db.logEntry.create({
            data: {
                id: nanoId16(),
                scope: "organization",
                organizationId: T.org,
                action: "Delete",
                objectType: "Person",
                objectId: T.deletedPerson,
                timestamp: new Date("2026-01-01T00:00:00.000Z"),
            },
        });
        await db.logEntry.create({
            data: {
                id: nanoId16(),
                scope: "organization",
                organizationId: T.org,
                action: "Delete",
                objectType: "Team",
                objectId: T.deletedTeam,
                timestamp: new Date("2026-02-01T00:00:00.000Z"),
            },
        });

        // A role on `organizationUser` for each caller, since `listTrash` reads roles directly
        // rather than through `ctx.hasPermission`.
        await db.organizationUser.create({
            data: {
                id: nanoId16(),
                organizationId: T.org,
                userId: T.adminUser,
                role: "admin",
            },
        });
        await db.organizationUser.create({
            data: {
                id: nanoId16(),
                organizationId: T.org,
                userId: T.personOnlyUser,
                role: "skills-assessor",
            },
        });
    });

    function makeCaller(
        userId: string,
        permissions: Record<string, string[]> = { organization: ["view"] },
    ) {
        return trashRouter.createCaller(
            createAuthenticatedMockContext({
                user: { id: userId },
                // `listTrash` filters per entity by reading `organizationUser.role` itself, not
                // via `ctx.hasPermission` — the mock's `organization:view` here only satisfies
                // `organizationProcedure`'s own base check.
                permissions,
                prisma: db,
            }),
        );
    }

    it("lists Deleted records across entity types for an admin, with deletedAt resolved", async () => {
        const rows = await makeCaller(T.adminUser).listTrash({ organizationId: T.org });

        expect(rows).toHaveLength(2);
        const person = rows.find((r) => r.id === T.deletedPerson);
        const team = rows.find((r) => r.id === T.deletedTeam);

        expect(person).toMatchObject({ type: "Person", name: "Grace Hopper" });
        expect(person?.deletedAt).toBe("2026-01-01T00:00:00.000Z");
        expect(team).toMatchObject({ type: "Team", name: "Doomed Team" });
        expect(team?.deletedAt).toBe("2026-02-01T00:00:00.000Z");
    });

    it("does not list Active records", async () => {
        const rows = await makeCaller(T.adminUser).listTrash({ organizationId: T.org });
        expect(rows.find((r) => r.id === T.activePerson)).toBeUndefined();
    });

    it("omits an entity's rows for a caller without delete permission on it", async () => {
        // `skills-assessor` has neither person:delete nor team:delete.
        const rows = await makeCaller(T.personOnlyUser).listTrash({ organizationId: T.org });
        expect(rows).toHaveLength(0);
    });

    it("is forbidden without organization:view permission", async () => {
        await expect(
            makeCaller(T.outsiderUser, {}).listTrash({ organizationId: T.org }),
        ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
});
