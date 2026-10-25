/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { NotConfiguredError } from "@/lib/errors";
import { nanoId16 } from "@/lib/id";
import type {
    D4HEquipmentItemDetail,
    D4HEquipmentListItem,
} from "@/lib/schemas/d4h/equipment-item";
import { OrganizationId } from "@/lib/schemas/organization";
import { getConfiguredD4HAccessToken } from "@/server/d4h-access-token";
import { fetchD4HWhoami, getD4HTeamMembers } from "@/server/d4h-api/client";
import {
    fetchD4HEquipmentItem,
    fetchD4HEquipmentItemContents,
    fetchD4HEquipmentItemsByKind,
    fetchD4HTeamEquipmentBrands,
    fetchD4HTeamEquipmentCategories,
    fetchD4HTeamEquipmentItems,
    fetchD4HTeamEquipmentKinds,
    fetchD4HTeamEquipmentModels,
    patchD4HEquipmentItem,
} from "@/server/d4h-api/equipment";
import { createMockPrisma } from "@/test/create-prisma-mock";
import { createAuthenticatedMockContext } from "@/test/trpc-helpers";

import { d4hApiRouter } from "./d4h-api-router";

const TEAM_ID = 7;
const OTHER_TEAM_ID = 8;
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
    getD4HTokenMetadata: vi.fn(async () => ({
        d4HTeams: [
            { id: 7, resourceType: "Team", title: "Rescue Team", permissions: {} },
            { id: OTHER_TEAM_ID, resourceType: "Team", title: "Alpine Team", permissions: {} },
        ],
        d4HOrganisations: [],
    })),
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
    fetchD4HEquipmentItemContents: vi.fn(),
    fetchD4HEquipmentItemsByKind: vi.fn(),
    fetchD4HTeamEquipmentBrands: vi.fn(),
    fetchD4HTeamEquipmentCategories: vi.fn(),
    fetchD4HTeamEquipmentItems: vi.fn(),
    fetchD4HTeamEquipmentKinds: vi.fn(),
    fetchD4HTeamEquipmentModels: vi.fn(),
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

/** A row as `fetchD4HEquipmentItemsByKind` returns it, owned by `teamId`. */
function listItem(
    id: number,
    teamId: number,
    overrides: Partial<D4HEquipmentListItem> = {},
): D4HEquipmentListItem {
    const { isCritical: _c, isMonitor: _m, barcode: _b, retiredReason: _r, ...base } = item();
    return {
        ...base,
        id,
        ref: String(id).padStart(6, "0"),
        owner: { resourceType: "Team", id: teamId },
        location: null,
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
        vi.mocked(fetchD4HEquipmentItemContents).mockReset();
        vi.mocked(fetchD4HEquipmentItemsByKind).mockReset();
        vi.mocked(fetchD4HTeamEquipmentItems).mockReset();
        // Clear only: keep the factory's member list as the default.
        vi.mocked(getD4HTeamMembers).mockClear();
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
    const editor = () => makeCaller({ d4hEquipment: ["update"] });

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

    describe("listEquipmentItemContents", () => {
        it("throws PRECONDITION_FAILED when no D4H token is configured", async () => {
            vi.mocked(getConfiguredD4HAccessToken).mockRejectedValue(
                new NotConfiguredError("No D4H access token configured."),
            );

            await expect(
                viewer().listEquipmentItemContents({
                    organizationId: T.org,
                    teamId: TEAM_ID,
                    itemId: ITEM_ID,
                }),
            ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
            expect(fetchD4HEquipmentItemContents).not.toHaveBeenCalled();
        });

        it("lists the items stored in the item, from its own team", async () => {
            vi.mocked(fetchD4HEquipmentItemContents).mockResolvedValue([
                listItem(1, TEAM_ID),
                listItem(2, TEAM_ID),
            ]);

            const result = await viewer().listEquipmentItemContents({
                organizationId: T.org,
                teamId: TEAM_ID,
                itemId: ITEM_ID,
            });

            expect(result.map((row) => row.id)).toEqual([1, 2]);
            expect(fetchD4HEquipmentItemContents).toHaveBeenCalledTimes(1);
            expect(fetchD4HEquipmentItemContents).toHaveBeenCalledWith(
                accessToken,
                TEAM_ID,
                ITEM_ID,
            );
        });

        it("strips each location to the holder's type and id", async () => {
            vi.mocked(fetchD4HEquipmentItemContents).mockResolvedValue([
                listItem(1, TEAM_ID, {
                    location: {
                        resourceType: "Member",
                        id: 42,
                        name: "John Smith",
                        address: { street: "1 Secret Street" },
                    } as D4HEquipmentListItem["location"],
                }),
            ]);

            const [row] = await viewer().listEquipmentItemContents({
                organizationId: T.org,
                teamId: TEAM_ID,
                itemId: ITEM_ID,
            });

            expect(row.location).toStrictEqual({ resourceType: "Member", id: 42 });
            expect(JSON.stringify(row)).not.toMatch(/Secret Street/);
        });

        it("throws NOT_FOUND for a team the token can't reach", async () => {
            await expect(
                viewer().listEquipmentItemContents({
                    organizationId: T.org,
                    teamId: 999,
                    itemId: ITEM_ID,
                }),
            ).rejects.toMatchObject({ code: "NOT_FOUND" });
            expect(fetchD4HEquipmentItemContents).not.toHaveBeenCalled();
        });
    });

    describe("listEquipmentKindItems", () => {
        it("throws PRECONDITION_FAILED when no D4H token is configured", async () => {
            vi.mocked(getConfiguredD4HAccessToken).mockRejectedValue(
                new NotConfiguredError("No D4H access token configured."),
            );

            await expect(
                viewer().listEquipmentKindItems({ organizationId: T.org, kindId: 8 }),
            ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
            expect(fetchD4HEquipmentItemsByKind).not.toHaveBeenCalled();
        });

        it("lists the kind's items across every team, each with its team's title", async () => {
            vi.mocked(fetchD4HEquipmentItemsByKind).mockImplementation(async (_token, teamId) =>
                teamId === TEAM_ID ? [listItem(1, TEAM_ID)] : [listItem(2, OTHER_TEAM_ID)],
            );

            const result = await viewer().listEquipmentKindItems({
                organizationId: T.org,
                kindId: 8,
            });

            expect(fetchD4HEquipmentItemsByKind).toHaveBeenCalledWith(accessToken, TEAM_ID, 8);
            expect(fetchD4HEquipmentItemsByKind).toHaveBeenCalledWith(
                accessToken,
                OTHER_TEAM_ID,
                8,
            );
            expect(result.map((row) => [row.id, row.team])).toEqual([
                [1, { id: TEAM_ID, title: "Rescue Team" }],
                [2, { id: OTHER_TEAM_ID, title: "Alpine Team" }],
            ]);
            expect(result.every((row) => row.holder === null)).toBe(true);
            // No member holds anything, so no member list is fetched.
            expect(getD4HTeamMembers).not.toHaveBeenCalled();
        });

        it("lists an item returned by two teams once", async () => {
            vi.mocked(fetchD4HEquipmentItemsByKind).mockResolvedValue([listItem(1, TEAM_ID)]);

            const result = await viewer().listEquipmentKindItems({
                organizationId: T.org,
                kindId: 8,
            });

            expect(result.map((row) => row.id)).toEqual([1]);
        });

        it("attributes a duplicate to its owner team even when another team lists it first", async () => {
            // Owned by OTHER_TEAM_ID, held by one of its members, but listed under TEAM_ID too
            // (and TEAM_ID is listed first).
            const held = listItem(1, OTHER_TEAM_ID, {
                location: { resourceType: "Member", id: 42 },
            });
            vi.mocked(fetchD4HEquipmentItemsByKind).mockResolvedValue([held]);

            const result = await viewer().listEquipmentKindItems({
                organizationId: T.org,
                kindId: 8,
            });

            expect(result.map((row) => [row.id, row.team, row.holder])).toEqual([
                [1, { id: OTHER_TEAM_ID, title: "Alpine Team" }, { id: 42, name: "John Smith" }],
            ]);
            // The holder is looked up in the owner's member list only.
            expect(getD4HTeamMembers).toHaveBeenCalledTimes(1);
            expect(getD4HTeamMembers).toHaveBeenCalledWith(
                expect.objectContaining({ credentialId: accessToken.id }),
                OTHER_TEAM_ID,
            );
        });

        it("names member holders from their team's list, and leaves others unnamed", async () => {
            vi.mocked(fetchD4HEquipmentItemsByKind).mockImplementation(async (_token, teamId) =>
                teamId === TEAM_ID
                    ? [
                          listItem(1, TEAM_ID, { location: { resourceType: "Member", id: 42 } }),
                          listItem(2, TEAM_ID, { location: { resourceType: "Member", id: 77 } }),
                          listItem(3, TEAM_ID, {
                              location: { resourceType: "EquipmentLocation", id: 5 },
                          }),
                      ]
                    : [],
            );

            const result = await viewer().listEquipmentKindItems({
                organizationId: T.org,
                kindId: 8,
            });

            expect(result.map((row) => [row.id, row.holder])).toEqual([
                [1, { id: 42, name: "John Smith" }],
                [2, { id: 77, name: null }],
                [3, null],
            ]);
            // Only the team with a member-held item has its members fetched.
            expect(getD4HTeamMembers).toHaveBeenCalledTimes(1);
            expect(getD4HTeamMembers).toHaveBeenCalledWith(
                expect.objectContaining({ credentialId: accessToken.id }),
                TEAM_ID,
            );
        });

        it("strips each location to the holder's type and id", async () => {
            vi.mocked(fetchD4HEquipmentItemsByKind).mockImplementation(async (_token, teamId) =>
                teamId === TEAM_ID
                    ? [
                          listItem(1, TEAM_ID, {
                              location: {
                                  resourceType: "Member",
                                  id: 42,
                                  name: "John Smith",
                                  address: { street: "1 Secret Street" },
                              } as D4HEquipmentListItem["location"],
                          }),
                      ]
                    : [],
            );

            const [row] = await viewer().listEquipmentKindItems({
                organizationId: T.org,
                kindId: 8,
            });

            expect(row.location).toStrictEqual({ resourceType: "Member", id: 42 });
            expect(JSON.stringify(row)).not.toMatch(/Secret Street/);
        });
    });

    describe("listTeamIssuedEquipment", () => {
        it("throws PRECONDITION_FAILED when no D4H token is configured", async () => {
            vi.mocked(getConfiguredD4HAccessToken).mockRejectedValue(
                new NotConfiguredError("No D4H access token configured."),
            );

            await expect(
                viewer().listTeamIssuedEquipment({ organizationId: T.org, teamId: TEAM_ID }),
            ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
            expect(fetchD4HTeamEquipmentItems).not.toHaveBeenCalled();
        });

        it("throws NOT_FOUND for a team the token can't reach", async () => {
            await expect(
                viewer().listTeamIssuedEquipment({ organizationId: T.org, teamId: 999 }),
            ).rejects.toMatchObject({ code: "NOT_FOUND" });
            expect(fetchD4HTeamEquipmentItems).not.toHaveBeenCalled();
        });

        it("keeps only the team's member-held items, each with its holder named from the team's list", async () => {
            vi.mocked(fetchD4HTeamEquipmentItems).mockResolvedValue([
                listItem(1, TEAM_ID, { location: { resourceType: "Member", id: 42 } }),
                listItem(2, TEAM_ID, { location: { resourceType: "Member", id: 77 } }),
                listItem(3, TEAM_ID, { location: { resourceType: "EquipmentLocation", id: 5 } }),
                listItem(4, TEAM_ID, { location: { resourceType: "Equipment", id: 6 } }),
                listItem(5, TEAM_ID),
                // Owned by another team: its item page lives there, so it's left out.
                listItem(6, OTHER_TEAM_ID, { location: { resourceType: "Member", id: 42 } }),
            ]);

            const result = await viewer().listTeamIssuedEquipment({
                organizationId: T.org,
                teamId: TEAM_ID,
            });

            expect(fetchD4HTeamEquipmentItems).toHaveBeenCalledTimes(1);
            expect(fetchD4HTeamEquipmentItems).toHaveBeenCalledWith(accessToken, TEAM_ID);
            expect(result.map((row) => [row.id, row.holder])).toEqual([
                [1, { id: 42, name: "John Smith" }],
                [2, { id: 77, name: null }],
            ]);
            expect(getD4HTeamMembers).toHaveBeenCalledTimes(1);
            expect(getD4HTeamMembers).toHaveBeenCalledWith(
                expect.objectContaining({ credentialId: accessToken.id }),
                TEAM_ID,
            );
        });

        it("skips the member list when nothing is issued", async () => {
            vi.mocked(fetchD4HTeamEquipmentItems).mockResolvedValue([listItem(1, TEAM_ID)]);

            const result = await viewer().listTeamIssuedEquipment({
                organizationId: T.org,
                teamId: TEAM_ID,
            });

            expect(result).toEqual([]);
            expect(getD4HTeamMembers).not.toHaveBeenCalled();
        });

        it("leaves holders unnamed when the member list can't be fetched", async () => {
            vi.mocked(fetchD4HTeamEquipmentItems).mockResolvedValue([
                listItem(1, TEAM_ID, { location: { resourceType: "Member", id: 42 } }),
            ]);
            vi.mocked(getD4HTeamMembers).mockRejectedValueOnce(new Error("D4H is down"));

            const result = await viewer().listTeamIssuedEquipment({
                organizationId: T.org,
                teamId: TEAM_ID,
            });

            expect(result.map((row) => row.holder)).toEqual([{ id: 42, name: null }]);
        });

        it("strips each location to the holder's type and id", async () => {
            vi.mocked(fetchD4HTeamEquipmentItems).mockResolvedValue([
                listItem(1, TEAM_ID, {
                    location: {
                        resourceType: "Member",
                        id: 42,
                        name: "John Smith",
                        address: { street: "1 Secret Street" },
                    } as D4HEquipmentListItem["location"],
                }),
            ]);

            const [row] = await viewer().listTeamIssuedEquipment({
                organizationId: T.org,
                teamId: TEAM_ID,
            });

            expect(row.location).toStrictEqual({ resourceType: "Member", id: 42 });
            expect(JSON.stringify(row)).not.toMatch(/Secret Street/);
        });
    });

    describe("listTeamMembers", () => {
        it("throws PRECONDITION_FAILED when no D4H token is configured", async () => {
            vi.mocked(getConfiguredD4HAccessToken).mockRejectedValue(
                new NotConfiguredError("No D4H access token configured."),
            );

            await expect(
                viewer().listTeamMembers({ organizationId: T.org, teamId: TEAM_ID }),
            ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
            expect(getD4HTeamMembers).not.toHaveBeenCalled();
        });

        it("returns the members of the requested team", async () => {
            const members = await viewer().listTeamMembers({
                organizationId: T.org,
                teamId: TEAM_ID,
            });

            expect(members.map((member) => member.name)).toEqual(["John Smith"]);
            expect(getD4HTeamMembers).toHaveBeenCalledWith(
                expect.objectContaining({ credentialId: accessToken.id }),
                TEAM_ID,
            );
        });

        it("throws NOT_FOUND for a team the token can't reach", async () => {
            await expect(
                viewer().listTeamMembers({ organizationId: T.org, teamId: 999 }),
            ).rejects.toMatchObject({ code: "NOT_FOUND" });
            expect(getD4HTeamMembers).not.toHaveBeenCalled();
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

        it("throws FORBIDDEN without d4hEquipment update", async () => {
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

        it("rejects an update that sets only updateNotes", async () => {
            await expect(
                editor().updateEquipmentItem({
                    organizationId: T.org,
                    teamId: TEAM_ID,
                    itemId: ITEM_ID,
                    updateNotes: "Just a note.",
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

describe("d4hApiRouter equipment catalogue lists", () => {
    const T = { org: OrganizationId.create(), user: nanoId16() };
    const db = createMockPrisma();

    const timestamps = { createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" };
    const teamOwner = (id: number, title: string) => ({ resourceType: "Team" as const, id, title });
    // Listed by both teams, owned by TEAM_ID.
    const shared = teamOwner(TEAM_ID, "Rescue Team");
    const other = teamOwner(OTHER_TEAM_ID, "Alpine Team");

    beforeAll(async () => {
        await db.organization.create({
            data: { id: T.org, name: "Acme", slug: "acme", createdAt: new Date() },
        });
    });

    beforeEach(() => {
        vi.mocked(getConfiguredD4HAccessToken)
            .mockReset()
            .mockResolvedValue(accessToken as never);
    });

    const viewer = () =>
        d4hApiRouter.createCaller(
            createAuthenticatedMockContext({
                user: { id: T.user },
                permissions: { organization: ["view"], d4hEquipment: ["view"] },
                prisma: db,
            }),
        );

    /** Each team lists the shared record and one of its own: "Zebra" from TEAM_ID, "Alpha" from the other. */
    function perTeam<R>(make: (id: number, title: string, owner: typeof shared) => R) {
        return async (_token: unknown, teamId: number) =>
            teamId === TEAM_ID
                ? [make(1, "Middle", shared), make(2, "Zebra", shared)]
                : [make(1, "Middle", shared), make(3, "Alpha", other)];
    }

    function expectFetchedPerTeam(fetcher: (...args: never[]) => unknown) {
        expect(fetcher).toHaveBeenCalledTimes(2);
        for (const teamId of [TEAM_ID, OTHER_TEAM_ID]) {
            expect(fetcher).toHaveBeenCalledWith(
                accessToken,
                teamId,
                expect.objectContaining({ d4HTeams: expect.any(Array) }),
            );
        }
    }

    it("listEquipmentCategories de-duplicates and sorts by title", async () => {
        vi.mocked(fetchD4HTeamEquipmentCategories)
            .mockReset()
            .mockImplementation(
                perTeam((id, title, owner) => ({
                    id,
                    resourceType: "EquipmentCategory" as const,
                    title,
                    owner,
                    ...timestamps,
                })),
            );

        const result = await viewer().listEquipmentCategories({ organizationId: T.org });

        expectFetchedPerTeam(fetchD4HTeamEquipmentCategories);
        expect(result.map((r) => [r.id, r.title, r.owner])).toEqual([
            [3, "Alpha", other],
            [1, "Middle", shared],
            [2, "Zebra", shared],
        ]);
    });

    it("listEquipmentKinds de-duplicates and keeps D4H's order", async () => {
        vi.mocked(fetchD4HTeamEquipmentKinds)
            .mockReset()
            .mockImplementation(
                perTeam((id, title, owner) => ({
                    id,
                    resourceType: "EquipmentKind" as const,
                    title,
                    category: { id: 9, resourceType: "EquipmentCategory" as const, title: "PPE" },
                    type: "EQUIPMENT" as const,
                    owner,
                    ...timestamps,
                })),
            );

        const result = await viewer().listEquipmentKinds({ organizationId: T.org });

        expectFetchedPerTeam(fetchD4HTeamEquipmentKinds);
        expect(result.map((r) => [r.id, r.title, r.owner])).toEqual([
            [1, "Middle", shared],
            [2, "Zebra", shared],
            [3, "Alpha", other],
        ]);
        expect(result[0].category).toEqual({
            id: 9,
            resourceType: "EquipmentCategory",
            title: "PPE",
        });
    });

    it("listEquipmentBrands de-duplicates and sorts by title", async () => {
        vi.mocked(fetchD4HTeamEquipmentBrands)
            .mockReset()
            .mockImplementation(
                perTeam((id, title, owner) => ({
                    id,
                    resourceType: "EquipmentBrand" as const,
                    title,
                    owner,
                    ...timestamps,
                })),
            );

        const result = await viewer().listEquipmentBrands({ organizationId: T.org });

        expectFetchedPerTeam(fetchD4HTeamEquipmentBrands);
        expect(result.map((r) => [r.id, r.title, r.owner])).toEqual([
            [3, "Alpha", other],
            [1, "Middle", shared],
            [2, "Zebra", shared],
        ]);
    });

    it("listEquipmentModels de-duplicates and sorts by title", async () => {
        vi.mocked(fetchD4HTeamEquipmentModels)
            .mockReset()
            .mockImplementation(
                perTeam((id, title, owner) => ({
                    id,
                    resourceType: "EquipmentModel" as const,
                    title,
                    owner,
                    brand: { id: 5, resourceType: "EquipmentBrand" as const },
                    updatedAt: timestamps.updatedAt,
                })),
            );

        const result = await viewer().listEquipmentModels({ organizationId: T.org });

        expectFetchedPerTeam(fetchD4HTeamEquipmentModels);
        expect(result.map((r) => [r.id, r.title, r.owner, r.brand.id])).toEqual([
            [3, "Alpha", other, 5],
            [1, "Middle", shared, 5],
            [2, "Zebra", shared, 5],
        ]);
    });
});
