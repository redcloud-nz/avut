/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { D4HAccessToken_ServerOnly } from "@/lib/schemas/d4h-access-token";
import { OrganizationId } from "@/lib/schemas/organization";
import { UserId } from "@/lib/schemas/user";
import { fetchD4HEquipmentItem } from "@/server/d4h-api/equipment";
import { createRetireTask } from "@/server/services/d4h-tasks";
import { createMockPrisma } from "@/test/create-prisma-mock";
import { createOrganizationMockContext } from "@/test/trpc-helpers";

import { returnItems } from "./return-items";

const TEAM_ID = 7;
const MEMBER_ID = 42;

const accessToken = {
    id: "token-1",
    serverCode: "ap",
    token: "secret",
} as unknown as D4HAccessToken_ServerOnly;

/** A single-item GET result (as `fetchD4HEquipmentItem` returns it, already parsed). */
function item(id: number, overrides: Record<string, unknown> = {}) {
    return {
        id,
        ref: String(id),
        status: "OPERATIONAL",
        serial: null,
        owner: { resourceType: "Team", id: TEAM_ID },
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
        ...overrides,
    };
}

// `vi.hoisted` because the client mock's factory below refers to it.
const GET = vi.hoisted(() => vi.fn());

vi.mock("@/server/d4h-api/client", () => ({
    getD4HFetchClient: vi.fn(() => ({ GET })),
}));

vi.mock("@/server/d4h-api/equipment", () => ({
    fetchD4HEquipmentItem: vi.fn(),
}));

describe("returnItems", () => {
    const T = {
        org: OrganizationId.create(),
        user: UserId.create(),
    };

    let db: ReturnType<typeof createMockPrisma>;

    beforeEach(async () => {
        // A fresh database per test: each asserts on the tasks and batches it alone created.
        db = createMockPrisma();
        await db.organization.create({
            data: { id: T.org, name: "Acme", slug: "acme", createdAt: new Date() },
        });
        await db.user.create({
            data: { id: T.user, name: "Receiver", email: "receiver@example.com" },
        });

        vi.mocked(fetchD4HEquipmentItem).mockImplementation(
            async (_token, _teamId, itemId) => item(itemId) as never,
        );
        GET.mockReset();
        GET.mockResolvedValue({
            data: { results: [{ id: 1 }, { id: 2 }, { id: 3 }], page: 0, pageSize: 3 },
            response: new Response(null, { status: 200 }),
        });
    });

    function ctx() {
        return createOrganizationMockContext({
            organizationId: T.org,
            user: { id: T.user, name: "Receiver", email: "receiver@example.com" },
            prisma: db,
        });
    }

    function run(itemIds: number[], comments = "") {
        return returnItems(ctx(), {
            accessToken,
            recipient: { id: MEMBER_ID, teamId: TEAM_ID, name: "John Smith" },
            items: itemIds.map((itemId) => ({ itemId, ref: String(itemId), kindTitle: "Helmet" })),
            comments,
        });
    }

    it("queues a retire task with a note for each held item, in one log batch", async () => {
        const result = await run([1, 2], "Strap frayed.");

        expect(result).toMatchObject({ returned: 2, failures: [] });
        expect(result.returnedItems.map((i) => i.itemId)).toEqual([1, 2]);

        const tasks = await db.d4HTask.findMany({ orderBy: { resourceId: "asc" } });
        expect(tasks).toMatchObject([
            {
                resourceId: 1,
                payload: {
                    reason: "Returned To Cache",
                    note: "Returned via AVUT, received by Receiver. Strap frayed.",
                },
                formInstanceId: null,
            },
            { resourceId: 2 },
        ]);

        const batches = await db.logBatch.findMany();
        expect(batches).toHaveLength(1);
        const entries = await db.logEntry.findMany();
        expect(entries).toHaveLength(2);
        expect(entries.every((entry) => entry.batchId === batches[0].id)).toBe(true);
    });

    it("labels the task and result from D4H's item, not the caller's labels", async () => {
        vi.mocked(fetchD4HEquipmentItem).mockResolvedValue(
            item(1, {
                ref: "A-1",
                kind: { resourceType: "EquipmentKind", id: 9, title: "Radio" },
            }) as never,
        );

        const result = await run([1]);

        const [task] = await db.d4HTask.findMany();
        expect(task.itemLabel).toBe("#A-1 Radio");
        expect(result.returnedItems).toMatchObject([{ itemId: 1, ref: "A-1", kindTitle: "Radio" }]);
    });

    it("omits blank comments from the note", async () => {
        await run([1], "   ");

        const [task] = await db.d4HTask.findMany();
        expect(task.payload).toEqual({
            reason: "Returned To Cache",
            note: "Returned via AVUT, received by Receiver.",
        });
    });

    it("skips missing, unheld, retired and already-queued items, and returns the rest", async () => {
        // Item 3 already has an open retire task from an earlier Return.
        await createRetireTask(ctx(), {
            d4hTeamId: TEAM_ID,
            itemId: 3,
            itemLabel: "#3 Helmet",
            reason: "Returned To Cache",
        });
        vi.mocked(fetchD4HEquipmentItem).mockImplementation(async (_token, _teamId, itemId) => {
            if (itemId === 4) return null; // deleted in D4H
            if (itemId === 5) return item(5, { owner: { resourceType: "Team", id: 99 } }) as never;
            if (itemId === 2) return item(2, { status: "RETIRED" }) as never;
            return item(itemId) as never;
        });
        GET.mockResolvedValue({
            data: { results: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 5 }], page: 0, pageSize: 4 },
            response: new Response(null, { status: 200 }),
        });

        // Item 6 isn't among the recipient's current items.
        const result = await run([4, 1, 6, 2, 3, 5]);

        expect(result.returned).toBe(1);
        expect(result.failures).toEqual([
            "#4 Helmet: not found in D4H",
            "#6 Helmet: not held by John Smith",
            "#2 Helmet: already retired",
            "#3 Helmet: already has an open retire task",
            "#5 Helmet: not found in D4H",
        ]);
        const tasks = await db.d4HTask.findMany({ where: { resourceId: { not: 3 } } });
        expect(tasks.map((t) => t.resourceId)).toEqual([1]);
    });

    it("keeps going past an item whose GET throws", async () => {
        vi.mocked(fetchD4HEquipmentItem).mockRejectedValueOnce(new Error("D4H said 500"));

        const result = await run([1, 2]);

        expect(result).toMatchObject({ returned: 1, failures: ["#1 Helmet: D4H said 500"] });
        expect((await db.d4HTask.findMany()).map((t) => t.resourceId)).toEqual([2]);
    });

    it("opens no log batch when every item fails", async () => {
        vi.mocked(fetchD4HEquipmentItem).mockResolvedValue(null);

        const result = await run([1, 2]);

        expect(result).toMatchObject({ returned: 0, returnedItems: [] });
        expect(result.failures).toHaveLength(2);
        expect(await db.logBatch.findMany()).toEqual([]);
        expect(await db.d4HTask.findMany()).toEqual([]);
    });
});
