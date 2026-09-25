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
import { createOrganizationMockContext } from "@/test/trpc-helpers";

import {
    archive,
    deleteRecord,
    getById,
    getDeleteImpact,
    requireById,
    restoreFromArchive,
    restoreFromTrash,
} from "./teams";

// The service reaches server-only modules at import time. The functions exercised here use an
// injected prisma client, so an empty stub is enough to let it import in jsdom.
vi.mock("server-only", () => ({}));

describe("teams", () => {
    const T = {
        org: OrganizationId.create(),
        otherOrg: OrganizationId.create(),
        plain: TeamId.create(),
        linked: TeamId.create(),
        outsider: TeamId.create(),
        user: UserId.create(),
    };

    const db = createMockPrisma();

    beforeAll(async () => {
        for (const id of [T.org, T.otherOrg]) {
            await db.organization.create({
                data: { id, name: id, slug: id, createdAt: new Date() },
            });
        }

        await db.team.create({
            data: {
                id: T.plain,
                organizationId: T.org,
                name: "Plain Team",
                tags: [],
                properties: {},
            },
        });
        await db.team.create({
            data: {
                id: T.linked,
                organizationId: T.org,
                name: "Linked Team",
                tags: [],
                properties: {},
            },
        });
        await db.team.create({
            data: {
                id: T.outsider,
                organizationId: T.otherOrg,
                name: "Outsider Team",
                tags: [],
                properties: {},
            },
        });

        await db.organization_D4H.create({
            data: {
                organizationId: T.org,
                serverCode: "us",
                d4hOrganisationId: 42,
                d4hOrganisationName: "Acme Rescue",
            },
        });

        await db.team_D4H.create({
            data: {
                teamId: T.linked,
                d4hTeamId: 4242,
                d4hTeamName: "Acme D4H Team",
                d4hServerCode: "us",
            },
        });
    });

    function ctx() {
        return createOrganizationMockContext({
            organizationId: T.org,
            user: { id: T.user },
            permissions: {},
            prisma: db,
        });
    }

    describe("getById", () => {
        it("returns the team when it exists in the organization", async () => {
            const team = await getById(ctx(), T.plain);

            expect(team?.id).toBe(T.plain);
            expect(team?.d4h).toBeNull();
        });

        it("resolves the D4H organisation name onto a linked team", async () => {
            const team = await getById(ctx(), T.linked);

            expect(team?.d4h?.d4hTeamId).toBe(4242);
            expect(team?.d4h?.d4hOrganisationName).toBe("Acme Rescue");
        });

        it("returns null for a team that does not exist", async () => {
            expect(await getById(ctx(), TeamId.create())).toBeNull();
        });

        it("does not reach across organizations", async () => {
            expect(await getById(ctx(), T.outsider)).toBeNull();
        });
    });

    describe("requireById", () => {
        it("returns the team when it exists", async () => {
            const team = await requireById(ctx(), T.plain);

            expect(team.id).toBe(T.plain);
        });

        it("throws NotFoundError when the team does not exist in this organization", async () => {
            await expect(requireById(ctx(), T.outsider)).rejects.toThrow(
                `Team(id=${T.outsider}) not found.`,
            );
        });
    });

    describe("archive / restoreFromArchive / restoreFromTrash / deleteRecord", () => {
        const L = { team: TeamId.create(), member: PersonId.create() };

        beforeAll(async () => {
            await db.team.create({
                data: {
                    id: L.team,
                    organizationId: T.org,
                    name: "Lifecycle Team",
                    tags: [],
                    properties: {},
                },
            });
            await db.person.create({
                data: {
                    id: L.member,
                    organizationId: T.org,
                    name: "Grace Hopper",
                    email: "grace-teams-lifecycle@example.com",
                    tags: [],
                    properties: {},
                },
            });
            await db.teamMembership.create({
                data: {
                    id: nanoId16(),
                    organizationId: T.org,
                    teamId: L.team,
                    personId: L.member,
                    tags: [],
                    properties: {},
                },
            });
        });

        it("archive moves an Active team to Archived and is idempotent", async () => {
            const archived = await archive(ctx(), L.team);
            expect(archived.status).toBe("Archived");

            const entries = await db.logEntry.findMany({
                where: { objectType: "Team", objectId: L.team, action: "Archive" },
            });
            expect(entries).toHaveLength(1);

            // Idempotent — no second log entry.
            await archive(ctx(), L.team);
            expect(
                await db.logEntry.findMany({
                    where: { objectType: "Team", objectId: L.team, action: "Archive" },
                }),
            ).toHaveLength(1);
        });

        it("restoreFromTrash rejects an Archived team", async () => {
            await expect(restoreFromTrash(ctx(), L.team)).rejects.toThrow(
                /only a Deleted team can be restored from trash/,
            );
        });

        it("restoreFromArchive moves an Archived team back to Active", async () => {
            const restored = await restoreFromArchive(ctx(), L.team);
            expect(restored.status).toBe("Active");
        });

        it("restoreFromArchive rejects a Deleted team", async () => {
            await deleteRecord(ctx(), L.team);
            await expect(restoreFromArchive(ctx(), L.team)).rejects.toThrow(
                /only an Archived team can be restored from archive/,
            );
        });

        it("deleteRecord does not touch TeamMembership rows", async () => {
            const membership = await db.teamMembership.findFirst({ where: { teamId: L.team } });
            expect(membership).toMatchObject({ status: "Active" });
        });

        it("restoreFromTrash moves a Deleted team back to Active", async () => {
            const restored = await restoreFromTrash(ctx(), L.team);
            expect(restored.status).toBe("Active");

            const entries = await db.logEntry.findMany({
                where: { objectType: "Team", objectId: L.team, action: "Restore" },
            });
            expect(entries.length).toBeGreaterThanOrEqual(1);
        });

        it("getDeleteImpact counts active memberships", async () => {
            expect(await getDeleteImpact(ctx(), L.team)).toEqual({ memberCount: 1 });
        });
    });
});
