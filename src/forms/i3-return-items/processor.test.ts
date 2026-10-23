/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ForbiddenError } from "@/lib/errors";
import { FormInstanceId } from "@/lib/schemas/form-instance";
import { OrganizationId } from "@/lib/schemas/organization";
import { UserId } from "@/lib/schemas/user";
import { fetchD4HWhoami } from "@/server/d4h-api/client";
import { fetchD4HEquipmentItem, patchD4HEquipmentItem } from "@/server/d4h-api/equipment";
import { sendEmail } from "@/server/email";
import { createRetireTask } from "@/server/services/d4h-tasks";
import { createMockPrisma } from "@/test/create-prisma-mock";
import { createOrganizationMockContext } from "@/test/trpc-helpers";

import { I3ReturnItemsFormProcessor } from "./processor";
import { I3ReturnItemsFormData } from "./schema";

const TEAM_ID = 7;
const MEMBER_ID = 42;

/** The resolved token `getConfiguredD4HAccessToken` hands back. */
const accessToken = { id: "token-1", serverCode: "ap", token: "secret" };

/** A whoami for a member of the recipient team, with or without `Equipment.UPDATE`. */
function whoami(canUpdate: boolean) {
    return {
        account: { id: 1, resourceType: "Account" },
        members: [
            {
                id: 11,
                resourceType: "Member",
                hasAccess: true,
                name: "Receiver",
                owner: { id: TEAM_ID, resourceType: "Team", title: "Rescue Team" },
                permissions: { Equipment: { UPDATE: canUpdate } },
            },
        ],
    };
}

/** A single-item GET result (as `fetchD4HEquipmentItem` returns it, already parsed). */
function item(id: number, overrides: Record<string, unknown> = {}) {
    return {
        id,
        ref: String(id),
        status: "OPERATIONAL",
        serial: null,
        owner: { resourceType: "Team", id: TEAM_ID },
        category: { resourceType: "EquipmentCategory", id: 3 },
        kind: { resourceType: "EquipmentKind", id: 8, title: "Helmet", category: { title: "PPE" } },
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

// The pipeline marks the form instance processed through the real Prisma client once every
// stage has run; stub it so nothing reaches a database.
vi.mock("@/server/prisma", () => ({
    default: { formInstance: { update: vi.fn(async () => ({})) } },
}));

vi.mock("@/server/d4h-access-token", () => ({
    getConfiguredD4HAccessToken: vi.fn(async () => accessToken),
    toD4HCredentialRef: vi.fn(() => ({ credentialId: "token-1" })),
}));

vi.mock("@/server/d4h-api/client", () => ({
    fetchD4HWhoami: vi.fn(),
    fetchD4HTeamDetailCached: vi.fn(async () => ({
        id: TEAM_ID,
        resourceType: "Team",
        title: "Rescue Team",
        timezone: "Pacific/Auckland",
        subdomain: "rescue",
    })),
    getD4HFetchClient: vi.fn(() => ({ GET })),
}));

vi.mock("@/server/d4h-api/equipment", () => ({
    fetchD4HEquipmentItem: vi.fn(),
    patchD4HEquipmentItem: vi.fn(async () => {}),
}));

vi.mock("@/server/email", () => ({
    NoReplyEmailAddress: "no-reply@example.test",
    sendEmail: vi.fn(async () => {}),
}));

describe("I3ReturnItemsFormProcessor", () => {
    const T = {
        org: OrganizationId.create(),
        user: UserId.create(),
    };

    let db: ReturnType<typeof createMockPrisma>;
    let formInstanceId: FormInstanceId;

    beforeAll(() => {
        // 20:00 UTC on 22 Oct is 23 Oct in Auckland: the note's date is in the team's timezone.
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date("2026-10-22T20:00:00Z"));
    });

    afterAll(() => {
        vi.useRealTimers();
    });

    beforeEach(async () => {
        // A fresh database per test: each asserts on the tasks and batches it alone created.
        db = createMockPrisma();
        await db.organization.create({
            data: { id: T.org, name: "Acme", slug: "acme", createdAt: new Date() },
        });
        await db.user.create({
            data: { id: T.user, name: "Receiver", email: "receiver@example.com" },
        });
        formInstanceId = FormInstanceId.create();
        await db.formInstance.create({
            data: { id: formInstanceId, formKey: "i3-return", organizationId: T.org },
        });

        vi.mocked(fetchD4HWhoami).mockResolvedValue(whoami(true) as never);
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

    function formData(itemIds: number[], comments = ""): I3ReturnItemsFormData {
        return I3ReturnItemsFormData.schema.parse({
            recipient: { id: MEMBER_ID, teamId: TEAM_ID, name: "John Smith" },
            items: itemIds.map((itemId) => ({ itemId, ref: String(itemId), kindTitle: "Helmet" })),
            comments,
        });
    }

    function execute(itemIds: number[], comments?: string) {
        return I3ReturnItemsFormProcessor.executeWithOutput(
            formInstanceId,
            formData(itemIds, comments),
            ctx(),
        );
    }

    /** The props the notification email was rendered with. */
    function emailProps() {
        expect(sendEmail).toHaveBeenCalledOnce();
        const { react } = vi.mocked(sendEmail).mock.calls[0][0];
        return (react as { props: { returnedItems: { itemId: number }[]; failures: string[] } })
            .props;
    }

    const NOTE = "Returned via AVUT, received by Receiver. Strap frayed.";

    it("marks each item INACTIVE with a note, queues a retire task and emails", async () => {
        const { results, output } = await execute([1, 2], "Strap frayed.");

        expect(results.every((r) => r.status === "success")).toBe(true);
        expect(output).toMatchObject({ returned: 2, failures: [] });

        // The recipient's current items are read with a member_id filter.
        expect(GET).toHaveBeenCalledWith("/v3/{context}/{contextId}/equipment", {
            params: {
                path: { context: "team", contextId: TEAM_ID },
                query: expect.objectContaining({ only_current: true, member_id: MEMBER_ID }),
            },
        });

        expect(patchD4HEquipmentItem).toHaveBeenCalledTimes(2);
        expect(patchD4HEquipmentItem).toHaveBeenCalledWith(accessToken, TEAM_ID, 1, {
            status: "INACTIVE",
            updateNotes: NOTE,
        });

        const tasks = await db.d4HTask.findMany({ orderBy: { resourceId: "asc" } });
        expect(tasks).toMatchObject([
            {
                d4hTeamId: TEAM_ID,
                resourceId: 1,
                itemLabel: "#1 Helmet",
                kind: "Retire",
                status: "Open",
                payload: { reason: "Returned To Cache" },
                formInstanceId,
            },
            { resourceId: 2, itemLabel: "#2 Helmet" },
        ]);

        // One batch, holding both item updates and both task creates.
        const batches = await db.logBatch.findMany();
        expect(batches).toHaveLength(1);
        expect(batches[0]).toMatchObject({ operationKey: "i3-return-items", userId: T.user });
        const entries = await db.logEntry.findMany();
        expect(entries).toHaveLength(4);
        expect(entries.every((entry) => entry.batchId === batches[0].id)).toBe(true);
        expect(
            entries.filter((e) => e.objectType === "D4HEquipmentItem").map((e) => e.objectId),
        ).toEqual(["1", "2"]);

        const props = emailProps();
        expect(props.returnedItems.map((i) => i.itemId)).toEqual([1, 2]);
        expect(props.failures).toEqual([]);
    });

    it("leaves the item's notes alone and omits empty comments", async () => {
        vi.mocked(fetchD4HEquipmentItem).mockResolvedValue(
            item(1, { notes: "Bought 2024.\nInspected 2025." }) as never,
        );

        await execute([1], "   ");

        expect(patchD4HEquipmentItem).toHaveBeenCalledWith(accessToken, TEAM_ID, 1, {
            status: "INACTIVE",
            updateNotes: "Returned via AVUT, received by Receiver.",
        });
    });

    it("refuses up front without Equipment.UPDATE on the recipient team", async () => {
        vi.mocked(fetchD4HWhoami).mockResolvedValue(whoami(false) as never);

        const { results } = await execute([1]);

        const last = results.at(-1);
        expect(last).toMatchObject({ stageName: "CheckPermissions", status: "error" });
        expect(last?.status === "error" && last.error).toBeInstanceOf(ForbiddenError);
        expect(fetchD4HEquipmentItem).not.toHaveBeenCalled();
        expect(patchD4HEquipmentItem).not.toHaveBeenCalled();
        expect(sendEmail).not.toHaveBeenCalled();
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
        const { output } = await execute([4, 1, 6, 2, 3, 5]);

        expect(output.returned).toBe(1);
        expect(output.failures).toEqual([
            "#4 Helmet: not found in D4H",
            "#6 Helmet: not held by John Smith",
            "#2 Helmet: already retired",
            "#3 Helmet: already has an open retire task",
            "#5 Helmet: not found in D4H",
        ]);
        expect(patchD4HEquipmentItem).toHaveBeenCalledOnce();
        expect(patchD4HEquipmentItem).toHaveBeenCalledWith(
            accessToken,
            TEAM_ID,
            1,
            expect.anything(),
        );
        expect(emailProps().failures).toHaveLength(5);
    });

    it("keeps going past a PATCH that throws", async () => {
        vi.mocked(patchD4HEquipmentItem).mockRejectedValueOnce(new Error("D4H said 400"));

        const { output } = await execute([1, 2]);

        expect(output).toMatchObject({ returned: 1, failures: ["#1 Helmet: D4H said 400"] });
        expect((await db.d4HTask.findMany()).map((t) => t.resourceId)).toEqual([2]);
    });

    it("opens no log batch when every item fails", async () => {
        vi.mocked(fetchD4HEquipmentItem).mockResolvedValue(null);

        const { results, output } = await execute([1, 2]);

        expect(results.every((r) => r.status === "success")).toBe(true);
        expect(output).toMatchObject({ returned: 0 });
        expect(output.failures).toHaveLength(2);
        expect(patchD4HEquipmentItem).not.toHaveBeenCalled();
        expect(await db.logBatch.findMany()).toEqual([]);
        expect(await db.d4HTask.findMany()).toEqual([]);
        expect(emailProps().returnedItems).toEqual([]);
    });
});
