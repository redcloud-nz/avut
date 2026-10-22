/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { NotConfiguredError } from "@/lib/errors";
import type { D4HTaskId } from "@/lib/schemas/d4h-task";
import type { D4HEquipmentItemDetail } from "@/lib/schemas/d4h/equipment-item";
import { OrganizationId } from "@/lib/schemas/organization";
import { UserId } from "@/lib/schemas/user";
import { getConfiguredD4HAccessToken } from "@/server/d4h-access-token";
import { fetchD4HWhoami, fetchD4HWhoamiCached } from "@/server/d4h-api/client";
import { fetchD4HEquipmentItem } from "@/server/d4h-api/equipment";
import { createRetireTask } from "@/server/services/d4h-tasks";
import { createMockPrisma } from "@/test/create-prisma-mock";
import { createAuthenticatedMockContext, createOrganizationMockContext } from "@/test/trpc-helpers";

import { d4hTasksRouter } from "./d4h-tasks-router";

/** The viewer holds RETIRE on this team... */
const RETIRE_TEAM = 7;
/** ...but not on this one. */
const OTHER_TEAM = 8;

const accessToken = {
    id: "d4h-token-fixture-id",
    organizationId: null,
    userId: null,
    label: "Test token",
    serverCode: "ap",
    token: "fake-token",
    metadata: { d4HTeams: [], d4HOrganisations: [] },
};

vi.mock("@/server/d4h-access-token", () => ({
    getConfiguredD4HAccessToken: vi.fn(),
    toD4HCredentialRef: vi.fn((token: { id: string }) => ({
        credentialId: token.id,
        organizationId: null,
        userId: null,
    })),
}));

vi.mock("@/server/d4h-api/client", () => ({
    fetchD4HTeamDetailCached: vi.fn(async (_ref: unknown, teamId: number) => ({
        id: teamId,
        resourceType: "Team",
        title: `Team ${teamId}`,
        timezone: "Pacific/Auckland",
        subdomain: `team${teamId}`,
    })),
    // `requireD4HTeamPermission` reads the uncached whoami; it runs for real against this.
    fetchD4HWhoami: vi.fn(),
    fetchD4HWhoamiCached: vi.fn(),
}));

vi.mock("@/server/d4h-api/equipment", () => ({
    fetchD4HEquipmentItem: vi.fn(),
}));

/** A whoami with RETIRE (as given) on `RETIRE_TEAM`, and no RETIRE on `OTHER_TEAM`. */
function whoami(retire: boolean) {
    const member = (teamId: number, title: string, canRetire: boolean) => ({
        id: teamId * 10,
        resourceType: "Member",
        hasAccess: true,
        name: "Member",
        owner: { id: teamId, resourceType: "Team", title },
        permissions: { Equipment: { UPDATE: true, RETIRE: canRetire } },
    });
    return {
        account: { id: 1, resourceType: "Account" },
        members: [
            member(RETIRE_TEAM, "Rescue Team", retire),
            member(OTHER_TEAM, "Other Team", false),
        ],
    } as never;
}

function item(itemId: number, status: string): D4HEquipmentItemDetail {
    return {
        id: itemId,
        ref: String(itemId),
        status,
        serial: null,
        owner: { resourceType: "Team", id: RETIRE_TEAM },
        category: { resourceType: "EquipmentCategory", id: 3 },
        kind: { resourceType: "EquipmentKind", id: 8, title: "Helmet" },
        brand: { resourceType: "EquipmentBrand", id: null },
        model: null,
        notes: "",
        parents: [],
        dateExpires: null,
        dateFirstUse: null,
        dateManufactured: null,
        datePurchased: null,
        dateRetired: null,
        dateWarranty: null,
        isCritical: false,
        isMonitor: false,
        barcode: null,
        retiredReason: null,
    };
}

describe("d4hTasksRouter", () => {
    const T = { org: OrganizationId.create(), user: UserId.create() };
    const db = createMockPrisma();
    const ids: Record<string, D4HTaskId> = {};

    async function retire(d4hTeamId: number, itemId: number) {
        const task = await createRetireTask(
            createOrganizationMockContext({
                organizationId: T.org,
                user: { id: T.user },
                permissions: {},
                prisma: db,
            }),
            { d4hTeamId, itemId, itemLabel: `#${itemId} Helmet`, reason: "Returned To Cache" },
        );
        return task.id;
    }

    beforeAll(async () => {
        // `Organization.createdAt` has no schema default — prisma-mock requires it.
        await db.organization.create({
            data: { id: T.org, name: "Acme", slug: "acme", createdAt: new Date() },
        });
        await db.user.create({
            data: { id: T.user, name: T.user, email: `${T.user}@example.com` },
        });

        // Items 1xx are listed and never changed; 2xx–5xx are consumed by one mutation test each.
        ids.listed1 = await retire(RETIRE_TEAM, 101);
        ids.listedOther = await retire(OTHER_TEAM, 102);
        ids.listed2 = await retire(RETIRE_TEAM, 103);
        ids.applied = await retire(RETIRE_TEAM, 201);
        ids.pending = await retire(RETIRE_TEAM, 301);
        ids.missing = await retire(RETIRE_TEAM, 401);
        ids.dismissed = await retire(RETIRE_TEAM, 501);
        ids.otherTeam = await retire(OTHER_TEAM, 601);
    });

    beforeEach(() => {
        vi.mocked(getConfiguredD4HAccessToken)
            .mockReset()
            .mockResolvedValue(accessToken as never);
        vi.mocked(fetchD4HEquipmentItem).mockReset();
        vi.mocked(fetchD4HWhoami).mockReset().mockResolvedValue(whoami(true));
        vi.mocked(fetchD4HWhoamiCached).mockReset().mockResolvedValue(whoami(true));
    });

    function makeCaller(perms: Record<string, string[]>) {
        return d4hTasksRouter.createCaller(
            createAuthenticatedMockContext({
                user: { id: T.user },
                // `organizationProcedure` always folds in `organization: ["view"]`.
                permissions: { organization: ["view"], ...perms },
                prisma: db,
            }),
        );
    }

    const viewer = () => makeCaller({ i3Item: ["view"] });
    const editor = () => makeCaller({ i3Item: ["view", "update"] });
    const equipmentViewer = () => makeCaller({ d4hEquipment: ["view"] });

    it("throws PRECONDITION_FAILED when no D4H token is configured", async () => {
        vi.mocked(getConfiguredD4HAccessToken).mockRejectedValue(
            new NotConfiguredError("No personal D4H access token."),
        );

        await expect(editor().listOpenTasks({ organizationId: T.org })).rejects.toMatchObject({
            code: "PRECONDITION_FAILED",
        });
        await expect(
            editor().checkTask({ organizationId: T.org, taskId: ids.pending }),
        ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    });

    it("throws FORBIDDEN without i3Item update", async () => {
        await expect(viewer().listOpenTasks({ organizationId: T.org })).rejects.toMatchObject({
            code: "FORBIDDEN",
        });
        await expect(
            viewer().checkTask({ organizationId: T.org, taskId: ids.pending }),
        ).rejects.toMatchObject({ code: "FORBIDDEN" });
        await expect(
            viewer().dismissTask({ organizationId: T.org, taskId: ids.pending }),
        ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    describe("listOpenTasks", () => {
        it("lists open tasks only on teams where the viewer holds RETIRE, with URL and team", async () => {
            const rows = await editor().listOpenTasks({ organizationId: T.org });

            expect(rows.every((row) => row.task.d4hTeamId === RETIRE_TEAM)).toBe(true);
            expect(rows.map((row) => row.task.id)).toEqual(
                expect.arrayContaining([ids.listed1, ids.listed2]),
            );
            expect(rows.map((row) => row.task.id)).not.toContain(ids.listedOther);

            const listed = rows.find((row) => row.task.id === ids.listed1);
            expect(listed).toMatchObject({
                teamTitle: "Rescue Team",
                d4hUrl: "https://team7.team-manager.ap.d4h.com/team/equipment/edit/101",
            });
        });

        it("lists nothing when the viewer holds RETIRE on no team", async () => {
            vi.mocked(fetchD4HWhoamiCached).mockResolvedValue(whoami(false));

            expect(await editor().listOpenTasks({ organizationId: T.org })).toEqual([]);
        });
    });

    describe("listItemTasks", () => {
        it("returns the item's open tasks when the viewer holds RETIRE", async () => {
            const tasks = await editor().listItemTasks({
                organizationId: T.org,
                teamId: RETIRE_TEAM,
                itemId: 101,
            });

            expect(tasks.map((task) => task.id)).toEqual([ids.listed1]);
        });

        it("returns nothing when the viewer lacks RETIRE on the team", async () => {
            const tasks = await editor().listItemTasks({
                organizationId: T.org,
                teamId: OTHER_TEAM,
                itemId: 102,
            });

            expect(tasks).toEqual([]);
        });
    });

    describe("listReturnedItemIds", () => {
        it("returns the team's open Retire item ids without a D4H token", async () => {
            vi.mocked(getConfiguredD4HAccessToken).mockRejectedValue(
                new NotConfiguredError("No personal D4H access token."),
            );

            const itemIds = await equipmentViewer().listReturnedItemIds({
                organizationId: T.org,
                teamId: OTHER_TEAM,
            });

            expect(itemIds.sort()).toEqual([102, 601]);
        });
    });

    describe("checkTask", () => {
        it("marks the task Done when the item is retired in D4H", async () => {
            vi.mocked(fetchD4HEquipmentItem).mockResolvedValue(item(201, "RETIRED"));

            const result = await editor().checkTask({ organizationId: T.org, taskId: ids.applied });

            expect(result).toMatchObject({
                result: "applied",
                task: { id: ids.applied, status: "Done", appliedById: T.user },
            });
            expect(fetchD4HEquipmentItem).toHaveBeenCalledWith(accessToken, RETIRE_TEAM, 201);
        });

        it("reports the item's status and leaves the task open when it isn't retired yet", async () => {
            vi.mocked(fetchD4HEquipmentItem).mockResolvedValue(item(301, "INACTIVE"));

            const result = await editor().checkTask({ organizationId: T.org, taskId: ids.pending });

            expect(result).toEqual({ result: "pending", status: "INACTIVE" });
            const task = await db.d4HTask.findUnique({ where: { id: ids.pending } });
            expect(task?.status).toBe("Open");
        });

        it("reports a missing item and leaves the task open", async () => {
            vi.mocked(fetchD4HEquipmentItem).mockResolvedValue(null);

            const result = await editor().checkTask({ organizationId: T.org, taskId: ids.missing });

            expect(result).toEqual({ result: "missing" });
            const task = await db.d4HTask.findUnique({ where: { id: ids.missing } });
            expect(task?.status).toBe("Open");
        });

        it("throws FORBIDDEN without D4H's Equipment RETIRE, and fetches nothing", async () => {
            await expect(
                editor().checkTask({ organizationId: T.org, taskId: ids.otherTeam }),
            ).rejects.toMatchObject({
                code: "FORBIDDEN",
                message: "You need D4H's Equipment RETIRE permission on Other Team to do this.",
            });
            expect(fetchD4HEquipmentItem).not.toHaveBeenCalled();
        });
    });

    describe("dismissTask", () => {
        it("throws FORBIDDEN without D4H's Equipment RETIRE", async () => {
            await expect(
                editor().dismissTask({ organizationId: T.org, taskId: ids.otherTeam }),
            ).rejects.toMatchObject({ code: "FORBIDDEN" });

            const task = await db.d4HTask.findUnique({ where: { id: ids.otherTeam } });
            expect(task?.status).toBe("Open");
        });

        it("dismisses the task, leaving it unapplied, and logs it", async () => {
            const { dismissed } = await editor().dismissTask({
                organizationId: T.org,
                taskId: ids.dismissed,
            });

            expect(dismissed).toMatchObject({
                status: "Dismissed",
                appliedById: null,
                appliedAt: null,
            });
            const entries = await db.logEntry.findMany({
                where: { objectType: "D4HTask", objectId: ids.dismissed, action: "Update" },
            });
            expect(entries).toHaveLength(1);
        });
    });
});
