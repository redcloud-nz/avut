/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { NotConfiguredError } from "@/lib/errors";
import { nanoId16 } from "@/lib/id";
import type { D4HEquipmentItemDetail } from "@/lib/schemas/d4h/equipment-item";
import { OrganizationId } from "@/lib/schemas/organization";
import { getConfiguredD4HAccessToken } from "@/server/d4h-access-token";
import { fetchD4HWhoami, getD4HTeamMembers } from "@/server/d4h-api/client";
import { fetchD4HEquipmentItem, patchD4HEquipmentItem } from "@/server/d4h-api/equipment";
import { createMockPrisma } from "@/test/create-prisma-mock";
import { createAuthenticatedMockContext } from "@/test/trpc-helpers";

import { d4hApiRouter } from "./d4h-api-router";

const TEAM_ID = 7;
const ITEM_ID = 1234;

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
    fetchD4HTeamDetailCached: vi.fn(async () => ({
        id: 7,
        resourceType: "Team",
        title: "Rescue Team",
        timezone: "Pacific/Auckland",
        subdomain: "rescue",
    })),
    // `requireD4HTeamPermission` reads the uncached whoami; it runs for real against this.
    fetchD4HWhoami: vi.fn(),
    getD4HTeamMembers: vi.fn(async () => [
        {
            id: 42,
            resourceType: "Member",
            email: { value: "john@example.com", verified: true },
            name: "John Smith",
            owner: { id: 7, resourceType: "Team" },
            position: null,
            ref: null,
            role: { id: null, resourceType: "Role" },
            status: "OPERATIONAL",
        },
    ]),
}));

vi.mock("@/server/d4h-api/equipment", () => ({
    fetchD4HEquipmentItem: vi.fn(),
    patchD4HEquipmentItem: vi.fn(),
}));

/** An item as `fetchD4HEquipmentItem` returns it (already parsed, so `location` is type and id only). */
function item(overrides: Partial<D4HEquipmentItemDetail> = {}): D4HEquipmentItemDetail {
    return {
        id: ITEM_ID,
        ref: "001234",
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

/** A whoami whose one membership, in `TEAM_ID`, holds the given Equipment permissions. */
function whoami(equipment: Record<string, boolean>) {
    return {
        account: { id: 1, resourceType: "Account" },
        members: [
            {
                id: 11,
                resourceType: "Member",
                hasAccess: true,
                name: "Member",
                owner: { id: TEAM_ID, resourceType: "Team", title: "Rescue Team" },
                permissions: { Equipment: equipment },
            },
        ],
    } as never;
}

describe("d4hApiRouter equipment items", () => {
    const T = { org: OrganizationId.create(), user: nanoId16() };
    const db = createMockPrisma();

    beforeAll(async () => {
        // `Organization.createdAt` has no schema default — prisma-mock requires it.
        await db.organization.create({
            data: { id: T.org, name: "Acme", slug: "acme", createdAt: new Date() },
        });
    });

    beforeEach(() => {
        vi.mocked(getConfiguredD4HAccessToken)
            .mockReset()
            .mockResolvedValue(accessToken as never);
        vi.mocked(fetchD4HEquipmentItem).mockReset();
        vi.mocked(patchD4HEquipmentItem).mockReset().mockResolvedValue();
        vi.mocked(fetchD4HWhoami)
            .mockReset()
            .mockResolvedValue(whoami({ UPDATE: true }));
    });

    function makeCaller(perms: Record<string, string[]>) {
        return d4hApiRouter.createCaller(
            createAuthenticatedMockContext({
                user: { id: T.user },
                // `organizationProcedure` always folds in `organization: ["view"]`.
                permissions: { organization: ["view"], ...perms },
                prisma: db,
            }),
        );
    }

    const viewer = () => makeCaller({ d4hEquipment: ["view"] });
    const editor = () => makeCaller({ i3Item: ["update"] });

    describe("getEquipmentItem", () => {
        it("throws PRECONDITION_FAILED when no D4H token is configured", async () => {
            vi.mocked(getConfiguredD4HAccessToken).mockRejectedValue(
                new NotConfiguredError("No personal D4H access token."),
            );

            await expect(
                viewer().getEquipmentItem({ organizationId: T.org, teamId: TEAM_ID, itemId: 1 }),
            ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
        });

        it("returns the item and its D4H web-app view URL", async () => {
            vi.mocked(fetchD4HEquipmentItem).mockResolvedValue(item());

            const result = await viewer().getEquipmentItem({
                organizationId: T.org,
                teamId: TEAM_ID,
                itemId: ITEM_ID,
            });

            expect(result.item.id).toBe(ITEM_ID);
            expect(result.d4hUrl).toBe(
                `https://rescue.team-manager.ap.d4h.com/team/equipment/view/${ITEM_ID}`,
            );
            expect(result.holder).toBeNull();
            expect(getD4HTeamMembers).not.toHaveBeenCalled();
        });

        it("names a member holder from the team's member list", async () => {
            vi.mocked(fetchD4HEquipmentItem).mockResolvedValue(
                item({ location: { resourceType: "Member", id: 42 } }),
            );

            const result = await viewer().getEquipmentItem({
                organizationId: T.org,
                teamId: TEAM_ID,
                itemId: ITEM_ID,
            });

            expect(result.holder).toEqual({ id: 42, name: "John Smith" });
            expect(result.item.location).toEqual({ resourceType: "Member", id: 42 });
        });

        it("leaves the name null for a holder outside the member list", async () => {
            vi.mocked(fetchD4HEquipmentItem).mockResolvedValue(
                item({ location: { resourceType: "Member", id: 77 } }),
            );

            const result = await viewer().getEquipmentItem({
                organizationId: T.org,
                teamId: TEAM_ID,
                itemId: ITEM_ID,
            });

            expect(result.holder).toEqual({ id: 77, name: null });
        });

        it("still returns the item when the member list can't be fetched", async () => {
            vi.mocked(fetchD4HEquipmentItem).mockResolvedValue(
                item({ location: { resourceType: "Member", id: 42 } }),
            );
            vi.mocked(getD4HTeamMembers).mockRejectedValueOnce(new Error("D4H is down"));

            const result = await viewer().getEquipmentItem({
                organizationId: T.org,
                teamId: TEAM_ID,
                itemId: ITEM_ID,
            });

            expect(result.item.id).toBe(ITEM_ID);
            expect(result.holder).toEqual({ id: 42, name: null });
        });

        it("returns no holder for a non-member location", async () => {
            vi.mocked(fetchD4HEquipmentItem).mockResolvedValue(
                item({ location: { resourceType: "EquipmentLocation", id: 5 } }),
            );

            const result = await viewer().getEquipmentItem({
                organizationId: T.org,
                teamId: TEAM_ID,
                itemId: ITEM_ID,
            });

            expect(result.holder).toBeNull();
            expect(result.item.location).toEqual({ resourceType: "EquipmentLocation", id: 5 });
        });

        it("throws NOT_FOUND when D4H has no such item", async () => {
            vi.mocked(fetchD4HEquipmentItem).mockResolvedValue(null);

            await expect(
                viewer().getEquipmentItem({
                    organizationId: T.org,
                    teamId: TEAM_ID,
                    itemId: ITEM_ID,
                }),
            ).rejects.toMatchObject({ code: "NOT_FOUND" });
        });

        it("throws NOT_FOUND for an item owned by another team", async () => {
            vi.mocked(fetchD4HEquipmentItem).mockResolvedValue(
                item({ owner: { resourceType: "Team", id: 99 } }),
            );

            await expect(
                viewer().getEquipmentItem({
                    organizationId: T.org,
                    teamId: TEAM_ID,
                    itemId: ITEM_ID,
                }),
            ).rejects.toMatchObject({ code: "NOT_FOUND" });
        });
    });

    describe("updateEquipmentItem", () => {
        it("throws PRECONDITION_FAILED when no D4H token is configured", async () => {
            vi.mocked(getConfiguredD4HAccessToken).mockRejectedValue(
                new NotConfiguredError("No personal D4H access token."),
            );

            await expect(
                editor().updateEquipmentItem({
                    organizationId: T.org,
                    teamId: TEAM_ID,
                    itemId: ITEM_ID,
                    status: "INACTIVE",
                }),
            ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
        });

        it("throws FORBIDDEN without i3Item update", async () => {
            await expect(
                viewer().updateEquipmentItem({
                    organizationId: T.org,
                    teamId: TEAM_ID,
                    itemId: ITEM_ID,
                    status: "INACTIVE",
                }),
            ).rejects.toMatchObject({ code: "FORBIDDEN" });
            expect(patchD4HEquipmentItem).not.toHaveBeenCalled();
        });

        it("throws FORBIDDEN without D4H's Equipment UPDATE, and patches nothing", async () => {
            vi.mocked(fetchD4HWhoami).mockResolvedValue(whoami({ UPDATE: false }));
            vi.mocked(fetchD4HEquipmentItem).mockResolvedValue(item());

            await expect(
                editor().updateEquipmentItem({
                    organizationId: T.org,
                    teamId: TEAM_ID,
                    itemId: ITEM_ID,
                    status: "INACTIVE",
                }),
            ).rejects.toMatchObject({
                code: "FORBIDDEN",
                message: "You need D4H's Equipment UPDATE permission on Rescue Team to do this.",
            });
            expect(patchD4HEquipmentItem).not.toHaveBeenCalled();
        });

        it("rejects an update with no fields set", async () => {
            await expect(
                editor().updateEquipmentItem({
                    organizationId: T.org,
                    teamId: TEAM_ID,
                    itemId: ITEM_ID,
                }),
            ).rejects.toMatchObject({ code: "BAD_REQUEST" });
            expect(patchD4HEquipmentItem).not.toHaveBeenCalled();
        });

        it("throws NOT_FOUND for an item owned by another team, and patches nothing", async () => {
            vi.mocked(fetchD4HEquipmentItem).mockResolvedValue(
                item({ owner: { resourceType: "Team", id: 99 } }),
            );

            await expect(
                editor().updateEquipmentItem({
                    organizationId: T.org,
                    teamId: TEAM_ID,
                    itemId: ITEM_ID,
                    status: "INACTIVE",
                }),
            ).rejects.toMatchObject({ code: "NOT_FOUND" });
            expect(patchD4HEquipmentItem).not.toHaveBeenCalled();
        });

        it("patches only the given fields, returns the re-fetched item and logs the change", async () => {
            vi.mocked(fetchD4HEquipmentItem)
                .mockResolvedValueOnce(item())
                .mockResolvedValueOnce(item({ status: "INACTIVE", notes: "Away for repair" }));

            const updated = await editor().updateEquipmentItem({
                organizationId: T.org,
                teamId: TEAM_ID,
                itemId: ITEM_ID,
                status: "INACTIVE",
                notes: "Away for repair",
            });

            expect(patchD4HEquipmentItem).toHaveBeenCalledWith(accessToken, TEAM_ID, ITEM_ID, {
                status: "INACTIVE",
                notes: "Away for repair",
            });
            expect(updated.status).toBe("INACTIVE");

            const entries = await db.logEntry.findMany({
                where: {
                    objectType: "D4HEquipmentItem",
                    objectId: String(ITEM_ID),
                    action: "Update",
                },
            });
            expect(entries).toHaveLength(1);
            expect(entries[0].changes).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        path: ["status"],
                        prev: "OPERATIONAL",
                        curr: "INACTIVE",
                    }),
                    expect.objectContaining({ path: ["notes"], prev: "", curr: "Away for repair" }),
                ]),
            );
        });

        it("logs and returns the expected item when the re-fetch after the PATCH fails", async () => {
            const itemId = ITEM_ID + 1;
            vi.spyOn(console, "error").mockImplementationOnce(() => {});
            vi.mocked(fetchD4HEquipmentItem)
                .mockResolvedValueOnce(item())
                .mockRejectedValueOnce(new Error("D4H said 500"));

            const updated = await editor().updateEquipmentItem({
                organizationId: T.org,
                teamId: TEAM_ID,
                itemId,
                status: "INACTIVE",
            });

            expect(updated.status).toBe("INACTIVE");
            const entries = await db.logEntry.findMany({
                where: { objectType: "D4HEquipmentItem", objectId: String(itemId) },
            });
            expect(entries).toHaveLength(1);
            expect(entries[0].changes).toEqual([
                expect.objectContaining({
                    path: ["status"],
                    prev: "OPERATIONAL",
                    curr: "INACTIVE",
                }),
            ]);
        });
    });
});
