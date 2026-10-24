/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { ForbiddenError } from "@/lib/errors";
import type { D4HAccessToken_ServerOnly } from "@/lib/schemas/d4h-access-token";
import { ProviderCredentialId } from "@/lib/schemas/provider-credential";

import {
    fetchD4HEquipmentItem,
    fetchD4HEquipmentItemContents,
    fetchD4HEquipmentItemsByKind,
    fetchD4HTeamEquipmentItems,
    patchD4HEquipmentItem,
} from "./equipment";

vi.mock("next/cache", () => ({ cacheLife: vi.fn(), cacheTag: vi.fn(), revalidateTag: vi.fn() }));

// `getD4HAccessToken`'s module pulls in Prisma and the settings cache, neither of which the
// accessor touches.
vi.mock("@/server/prisma", () => ({ default: {} }));
vi.mock("@/server/encrypt", () => ({ decryptDBValue: (value: string) => value }));
vi.mock("@/server/cache/organization-settings", () => ({ getOrganizationSettings: vi.fn() }));

const token: D4HAccessToken_ServerOnly = {
    id: ProviderCredentialId.create(),
    organizationId: null,
    userId: null,
    label: "Test token",
    serverCode: "ap",
    token: "the-api-key",
    metadata: { d4HTeams: [], d4HOrganisations: [] },
};

/** A single-item GET response, shaped like the 2026-10-22 live probe. */
const itemFixture = {
    id: 1234,
    ref: "001234",
    status: "OPERATIONAL",
    serial: null,
    owner: { resourceType: "Team", id: 7 },
    category: { resourceType: "EquipmentCategory", id: 3 },
    kind: {
        resourceType: "EquipmentKind",
        id: 8,
        title: "Helmet",
        category: { resourceType: "EquipmentCategory", id: 3, title: "PPE" },
    },
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
    isMonitor: true,
    barcode: null,
    retiredReason: null,
    // D4H expands a holding member to their full record. Only `resourceType` and `id` may survive.
    location: {
        resourceType: "Member",
        id: 99,
        name: "Jane Doe",
        ref: "JD",
        position: "Team Leader",
        status: "OPERATIONAL",
        owner: { resourceType: "Team", id: 7 },
        email: { value: "jane@example.com", verified: true },
        mobilephone: "+64 21 000 0000",
        homephone: "+64 9 000 0000",
        workphone: null,
        address: {
            street: "1 Secret Street",
            town: "Auckland",
            region: "Auckland",
            postcode: "1010",
            country: "NZ",
        },
        location: { type: "Point", coordinates: [174.76, -36.85] },
        emergencyContacts: [
            { name: "John Doe", relation: "Partner", primaryPhone: "+64 21 111 1111" },
        ],
        icalSecret: "ical-secret-value",
        notes: "Allergic to bees",
        customFieldValues: [{ customField: { id: 5 }, value: "O+" }],
        startsAt: "2020-01-01T00:00:00Z",
    },
};

describe("fetchD4HEquipmentItem", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("parses the item and strips its location down to the holder's type and id", async () => {
        const fetchMock = vi.fn(async (_request: Request) => Response.json(itemFixture));
        vi.stubGlobal("fetch", fetchMock);

        const item = await fetchD4HEquipmentItem(token, 7, 1234);

        expect(item).not.toBeNull();
        // Exactly these keys: none of the member record's PII survives the parse.
        expect(item!.location).toStrictEqual({ resourceType: "Member", id: 99 });
        expect(JSON.stringify(item)).not.toMatch(/Secret Street|jane@example|ical-secret|John Doe/);
        expect(fetchMock.mock.calls[0][0].url).toBe(
            "https://api.team-manager.ap.d4h.com/v3/team/7/equipment/1234",
        );
    });

    it("returns null on a 404", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => Response.json({ message: "Not Found" }, { status: 404 })),
        );

        await expect(fetchD4HEquipmentItem(token, 7, 1234)).resolves.toBeNull();
    });

    it("throws ForbiddenError on a 403", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => Response.json({ message: "Forbidden" }, { status: 403 })),
        );

        await expect(fetchD4HEquipmentItem(token, 7, 1234)).rejects.toThrow(ForbiddenError);
    });

    it("throws on any other failure", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => new Response(null, { status: 500 })),
        );

        await expect(fetchD4HEquipmentItem(token, 7, 1234)).rejects.toThrow(/500/);
    });
});

describe("fetchD4HEquipmentItemContents", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("lists the item's current contents, stripping each location to the holder's type and id", async () => {
        const fetchMock = vi.fn(async (_request: Request) =>
            Response.json({ results: [itemFixture], page: 0, pageSize: 10000, totalSize: 1 }),
        );
        vi.stubGlobal("fetch", fetchMock);

        const items = await fetchD4HEquipmentItemContents(token, 7, 555);

        expect(items).toHaveLength(1);
        expect(items[0].location).toStrictEqual({ resourceType: "Member", id: 99 });
        expect(JSON.stringify(items)).not.toMatch(
            /Secret Street|jane@example|ical-secret|John Doe/,
        );

        const url = new URL(fetchMock.mock.calls[0][0].url);
        expect(url.pathname).toBe("/v3/team/7/equipment");
        expect(url.searchParams.get("parent_id")).toBe("555");
        expect(url.searchParams.get("only_current")).toBe("true");
        expect(url.searchParams.get("size")).toBe("10000");
    });

    it("throws on failure", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => new Response(null, { status: 500 })),
        );

        await expect(fetchD4HEquipmentItemContents(token, 7, 555)).rejects.toThrow(/500/);
    });
});

describe("fetchD4HEquipmentItemsByKind", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("lists the kind's current items, stripping each location to the holder's type and id", async () => {
        const fetchMock = vi.fn(async (_request: Request) =>
            Response.json({ results: [itemFixture], page: 0, pageSize: 10000, totalSize: 1 }),
        );
        vi.stubGlobal("fetch", fetchMock);

        const items = await fetchD4HEquipmentItemsByKind(token, 7, 8);

        expect(items).toHaveLength(1);
        expect(items[0].location).toStrictEqual({ resourceType: "Member", id: 99 });
        expect(JSON.stringify(items)).not.toMatch(
            /Secret Street|jane@example|ical-secret|John Doe/,
        );

        const url = new URL(fetchMock.mock.calls[0][0].url);
        expect(url.pathname).toBe("/v3/team/7/equipment");
        expect(url.searchParams.getAll("kind_id")).toEqual(["8"]);
        expect(url.searchParams.get("only_current")).toBe("true");
        expect(url.searchParams.get("size")).toBe("10000");
    });

    it("throws on failure", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => new Response(null, { status: 500 })),
        );

        await expect(fetchD4HEquipmentItemsByKind(token, 7, 8)).rejects.toThrow(/500/);
    });
});

describe("fetchD4HTeamEquipmentItems", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("lists the team's current items in one request, stripping each location to the holder's type and id", async () => {
        const fetchMock = vi.fn(async (_request: Request) =>
            Response.json({ results: [itemFixture], page: 0, pageSize: 10000, totalSize: 1 }),
        );
        vi.stubGlobal("fetch", fetchMock);

        const items = await fetchD4HTeamEquipmentItems(token, 7);

        expect(items).toHaveLength(1);
        expect(items[0].location).toStrictEqual({ resourceType: "Member", id: 99 });
        expect(JSON.stringify(items)).not.toMatch(
            /Secret Street|jane@example|ical-secret|John Doe/,
        );

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const url = new URL(fetchMock.mock.calls[0][0].url);
        expect(url.pathname).toBe("/v3/team/7/equipment");
        expect(url.searchParams.get("only_current")).toBe("true");
        expect(url.searchParams.get("size")).toBe("10000");
    });

    it("keeps an item whose location has no id", async () => {
        const withoutId = { ...itemFixture, id: 1235, location: { resourceType: "Member" } };
        vi.stubGlobal(
            "fetch",
            vi.fn(async () =>
                Response.json({
                    results: [itemFixture, withoutId],
                    page: 0,
                    pageSize: 10000,
                    totalSize: 2,
                }),
            ),
        );

        const items = await fetchD4HTeamEquipmentItems(token, 7);

        expect(items.map((item) => item.location)).toStrictEqual([
            { resourceType: "Member", id: 99 },
            { resourceType: "Member" },
        ]);
    });

    it("throws on failure", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => new Response(null, { status: 500 })),
        );

        await expect(fetchD4HTeamEquipmentItems(token, 7)).rejects.toThrow(/500/);
    });
});

describe("patchD4HEquipmentItem", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("sends only the provided keys", async () => {
        const fetchMock = vi.fn(async (_request: Request) => Response.json(itemFixture));
        vi.stubGlobal("fetch", fetchMock);

        await patchD4HEquipmentItem(token, 7, 1234, {
            status: "INACTIVE",
            notes: "Returned",
            barcode: undefined,
        });

        const request = fetchMock.mock.calls[0][0];
        expect(request.method).toBe("PATCH");
        expect(request.url).toBe("https://api.team-manager.ap.d4h.com/v3/team/7/equipment/1234");
        expect(await request.json()).toEqual({ status: "INACTIVE", notes: "Returned" });
    });

    it("throws with D4H's status and body on failure", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => Response.json({ message: "Unknown field" }, { status: 400 })),
        );

        await expect(patchD4HEquipmentItem(token, 7, 1234, { isCritical: true })).rejects.toThrow(
            /400.*Unknown field/,
        );
    });
});
