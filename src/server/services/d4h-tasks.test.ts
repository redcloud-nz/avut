/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { beforeAll, describe, expect, it } from "vitest";

import { ConflictError, NotFoundError } from "@/lib/errors";
import { D4HTaskId } from "@/lib/schemas/d4h-task";
import { OrganizationId } from "@/lib/schemas/organization";
import { UserId } from "@/lib/schemas/user";
import { createMockPrisma } from "@/test/create-prisma-mock";
import { createOrganizationMockContext } from "@/test/trpc-helpers";

import {
    createRetireTask,
    dismiss,
    hasOpenRetireTask,
    listForItem,
    listOpen,
    listOpenRetireItemIds,
    markApplied,
    requireById,
} from "./d4h-tasks";

describe("d4h-tasks", () => {
    const T = {
        org: OrganizationId.create(),
        otherOrg: OrganizationId.create(),
        user: UserId.create(),
        teamA: 101,
        teamB: 102,
        teamC: 103,
    };

    const db = createMockPrisma();

    beforeAll(async () => {
        for (const id of [T.org, T.otherOrg]) {
            await db.organization.create({
                data: { id, name: id, slug: id, createdAt: new Date() },
            });
        }
        await db.user.create({
            data: { id: T.user, name: T.user, email: `${T.user}@example.com` },
        });
    });

    function ctx(organizationId: OrganizationId = T.org) {
        return createOrganizationMockContext({
            organizationId,
            user: { id: T.user },
            permissions: {},
            prisma: db,
        });
    }

    function retire(d4hTeamId: number, itemId: number, organizationId?: OrganizationId) {
        return createRetireTask(ctx(organizationId), {
            d4hTeamId,
            itemId,
            itemLabel: `#${itemId} Helmet`,
            reason: "Returned To Cache",
        });
    }

    describe("createRetireTask", () => {
        it("creates an open, manual Retire task and logs Create", async () => {
            const task = await retire(T.teamA, 1);

            expect(task).toMatchObject({
                organizationId: T.org,
                d4hTeamId: T.teamA,
                resourceType: "Equipment",
                resourceId: 1,
                itemLabel: "#1 Helmet",
                kind: "Retire",
                payload: { reason: "Returned To Cache" },
                status: "Open",
                applyMethod: "Manual",
                requestedById: T.user,
                appliedById: null,
                appliedAt: null,
                formInstanceId: null,
            });

            const entries = await db.logEntry.findMany({
                where: { objectType: "D4HTask", objectId: task.id, action: "Create" },
            });
            expect(entries).toHaveLength(1);
        });
    });

    describe("listOpen / listForItem / listOpenRetireItemIds / hasOpenRetireTask", () => {
        const L = { teamA: 201, teamB: 202 };
        const ids: Record<string, D4HTaskId> = {};

        beforeAll(async () => {
            ids.first = (await retire(L.teamA, 10)).id;
            ids.second = (await retire(L.teamB, 20)).id;
            ids.third = (await retire(L.teamA, 11)).id;
            ids.closed = (await retire(L.teamA, 12)).id;
            await dismiss(ctx(), ids.closed);
            await retire(L.teamA, 13, T.otherOrg);
        });

        it("listOpen returns open tasks on the given teams, oldest first", async () => {
            const rows = await listOpen(ctx(), { d4hTeamIds: [L.teamA, L.teamB] });

            expect(rows.map((row) => row.task.id)).toEqual([ids.first, ids.second, ids.third]);
            expect(rows[0].requestedByName).toBe(T.user);
        });

        it("listOpen filters by team", async () => {
            const rows = await listOpen(ctx(), { d4hTeamIds: [L.teamB] });

            expect(rows.map((row) => row.task.id)).toEqual([ids.second]);
        });

        it("listOpen returns nothing for no teams", async () => {
            expect(await listOpen(ctx(), { d4hTeamIds: [] })).toEqual([]);
        });

        it("listForItem returns only the item's open tasks", async () => {
            expect(
                (await listForItem(ctx(), { d4hTeamId: L.teamA, itemId: 10 })).map((t) => t.id),
            ).toEqual([ids.first]);
            expect(await listForItem(ctx(), { d4hTeamId: L.teamA, itemId: 12 })).toEqual([]);
            expect(await listForItem(ctx(), { d4hTeamId: L.teamB, itemId: 10 })).toEqual([]);
        });

        it("listOpenRetireItemIds returns the team's items with an open Retire task", async () => {
            const itemIds = await listOpenRetireItemIds(ctx(), { d4hTeamId: L.teamA });

            expect([...itemIds].sort()).toEqual([10, 11]);
        });

        it("hasOpenRetireTask reflects open tasks only, within the organization", async () => {
            expect(await hasOpenRetireTask(ctx(), { d4hTeamId: L.teamA, itemId: 10 })).toBe(true);
            expect(await hasOpenRetireTask(ctx(), { d4hTeamId: L.teamA, itemId: 12 })).toBe(false);
            expect(await hasOpenRetireTask(ctx(), { d4hTeamId: L.teamA, itemId: 13 })).toBe(false);
        });
    });

    describe("requireById", () => {
        it("returns the task when it exists in the organization", async () => {
            const task = await retire(T.teamB, 2);

            expect((await requireById(ctx(), task.id)).id).toBe(task.id);
        });

        it("throws NotFoundError for a task in another organization", async () => {
            const task = await retire(T.teamB, 3, T.otherOrg);

            await expect(requireById(ctx(), task.id)).rejects.toThrow(NotFoundError);
        });

        it("throws NotFoundError for a task that does not exist", async () => {
            await expect(requireById(ctx(), D4HTaskId.create())).rejects.toThrow(NotFoundError);
        });
    });

    describe("markApplied", () => {
        it("sets Done with the caller and time, and logs Update", async () => {
            const task = await retire(T.teamC, 4);

            const applied = await markApplied(ctx(), task.id);

            expect(applied.status).toBe("Done");
            expect(applied.appliedById).toBe(T.user);
            expect(applied.appliedAt).not.toBeNull();

            const entries = await db.logEntry.findMany({
                where: { objectType: "D4HTask", objectId: task.id, action: "Update" },
            });
            expect(entries).toHaveLength(1);
        });

        it("throws ConflictError unless the task is Open", async () => {
            const task = await retire(T.teamC, 5);
            await markApplied(ctx(), task.id);

            await expect(markApplied(ctx(), task.id)).rejects.toThrow(ConflictError);

            const dismissed = await retire(T.teamC, 6);
            await dismiss(ctx(), dismissed.id);
            await expect(markApplied(ctx(), dismissed.id)).rejects.toThrow(ConflictError);
        });
    });

    describe("dismiss", () => {
        it("sets Dismissed, leaves applied* null, and logs Update", async () => {
            const task = await retire(T.teamC, 7);

            const dismissed = await dismiss(ctx(), task.id);

            expect(dismissed.status).toBe("Dismissed");
            expect(dismissed.appliedById).toBeNull();
            expect(dismissed.appliedAt).toBeNull();

            const entries = await db.logEntry.findMany({
                where: { objectType: "D4HTask", objectId: task.id, action: "Update" },
            });
            expect(entries).toHaveLength(1);
        });

        it("throws ConflictError unless the task is Open", async () => {
            const task = await retire(T.teamC, 8);
            await dismiss(ctx(), task.id);

            await expect(dismiss(ctx(), task.id)).rejects.toThrow(ConflictError);

            const applied = await retire(T.teamC, 9);
            await markApplied(ctx(), applied.id);
            await expect(dismiss(ctx(), applied.id)).rejects.toThrow(ConflictError);
        });
    });
});
