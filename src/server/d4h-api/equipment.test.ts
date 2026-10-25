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
    fetchD4HTeamEquipmentCatalogue,
    fetchD4HTeamEquipmentCategories,
    fetchD4HTeamEquipmentItems,
    fetchD4HTeamEquipmentModels,
    patchD4HEquipmentItem,
    resolveCatalogueOwner,
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

/** Two reachable teams in organisation 100, and organisation 100 itself. */
const catalogueMetadata = {
    d4HTeams: [
        {
            id: 7,
            resourceType: "Team" as const,
            title: "Rescue Team",
            owner: { id: 100, resourceType: "Organisation" as const, title: "Regional SAR" },
            permissions: {},
        },
        {
            id: 8,
            resourceType: "Team" as const,
            title: "Alpine Team",
            owner: { id: 100, resourceType: "Organisation" as const, title: "Regional SAR" },
            permissions: {},
        },
    ],
    d4HOrganisations: [{ id: 100, resourceType: "Organisation" as const, title: "Regional SAR" }],
};

describe("resolveCatalogueOwner", () => {
    it("keeps a team owner listed by its own team, titled from the token's teams", () => {
        expect(resolveCatalogueOwner({ resourceType: "Team", id: 7 }, catalogueMetadata)).toEqual({
            resourceType: "Team",
            id: 7,
            title: "Rescue Team",
        });
    });

    it("keeps an organisation owner, titled from the token's organisations", () => {
        expect(
            resolveCatalogueOwner({ resourceType: "Organisation", id: 100 }, catalogueMetadata),
        ).toEqual({ resourceType: "Organisation", id: 100, title: "Regional SAR" });
    });

    it("keeps an unreachable team's id, with a fallback title", () => {
        expect(resolveCatalogueOwner({ resourceType: "Team", id: 99 }, catalogueMetadata)).toEqual({
            resourceType: "Team",
            id: 99,
            title: "Another D4H team",
        });
    });

    it("keeps an unknown organisation's id, with a fallback title", () => {
        expect(
            resolveCatalogueOwner({ resourceType: "Organisation", id: 200 }, catalogueMetadata),
        ).toEqual({ resourceType: "Organisation", id: 200, title: "D4H organisation" });
    });
});

describe("D4H team catalogue fetchers", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    const timestamps = { createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" };

    function category(id: number, owner: { resourceType: string; id: number }) {
        return {
            id,
            resourceType: "EquipmentCategory",
            title: `Category ${id}`,
            owner,
            ...timestamps,
        };
    }

    function stubList(results: unknown[]) {
        const fetchMock = vi.fn(async (_request: Request) =>
            Response.json({
                results,
                page: 0,
                pageSize: results.length,
                totalSize: results.length,
            }),
        );
        vi.stubGlobal("fetch", fetchMock);
        return fetchMock;
    }

    it("resolves each record's real owner, never the listing team", async () => {
        const fetchMock = stubList([
            // Owned by the listing team.
            category(1, { resourceType: "Team", id: 7 }),
            // Owned by another reachable team, but listed by team 7.
            category(2, { resourceType: "Team", id: 8 }),
            // Owned by a team the token can't reach.
            category(3, { resourceType: "Team", id: 99 }),
            // Owned by the token's organisation.
            category(4, { resourceType: "Organisation", id: 100 }),
            // Owned by an organisation the token doesn't know.
            category(5, { resourceType: "Organisation", id: 200 }),
        ]);

        const categories = await fetchD4HTeamEquipmentCategories(token, 7, catalogueMetadata);

        expect(categories.map((c) => [c.id, c.owner])).toEqual([
            [1, { resourceType: "Team", id: 7, title: "Rescue Team" }],
            [2, { resourceType: "Team", id: 8, title: "Alpine Team" }],
            [3, { resourceType: "Team", id: 99, title: "Another D4H team" }],
            [4, { resourceType: "Organisation", id: 100, title: "Regional SAR" }],
            [5, { resourceType: "Organisation", id: 200, title: "D4H organisation" }],
        ]);
        expect(new URL(fetchMock.mock.calls[0][0].url).pathname).toBe(
            "/v3/team/7/equipment-categories",
        );
    });

    it("throws naming the list and the team on failure", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => new Response(null, { status: 500 })),
        );

        await expect(fetchD4HTeamEquipmentModels(token, 7, catalogueMetadata)).rejects.toThrow(
            "Failed to fetch equipment models for team 7",
        );
    });

    it("fetches the whole catalogue from each list endpoint", async () => {
        const owner = { resourceType: "Organisation", id: 100 };
        const byPath: Record<string, unknown[]> = {
            "/v3/team/7/equipment-categories": [category(1, owner)],
            "/v3/team/7/equipment-kinds": [
                {
                    id: 2,
                    resourceType: "EquipmentKind",
                    title: "Helmet",
                    category: { id: 1, resourceType: "EquipmentCategory", title: "Category 1" },
                    type: "EQUIPMENT",
                    owner,
                    ...timestamps,
                },
            ],
            "/v3/team/7/equipment-brands": [
                { id: 3, resourceType: "EquipmentBrand", title: "Petzl", owner, ...timestamps },
            ],
            "/v3/team/7/equipment-models": [
                {
                    id: 4,
                    resourceType: "EquipmentModel",
                    title: "Vertex",
                    owner,
                    brand: { id: 3, resourceType: "EquipmentBrand" },
                    updatedAt: timestamps.updatedAt,
                },
            ],
        };
        vi.stubGlobal(
            "fetch",
            vi.fn(async (request: Request) => {
                const results = byPath[new URL(request.url).pathname] ?? [];
                return Response.json({ results, page: 0, pageSize: 1, totalSize: 1 });
            }),
        );

        const catalogue = await fetchD4HTeamEquipmentCatalogue(token, 7, catalogueMetadata);

        const orgOwner = { resourceType: "Organisation", id: 100, title: "Regional SAR" };
        expect(catalogue.categories.map((r) => [r.id, r.owner])).toEqual([[1, orgOwner]]);
        expect(catalogue.kinds.map((r) => [r.id, r.owner])).toEqual([[2, orgOwner]]);
        expect(catalogue.brands.map((r) => [r.id, r.owner])).toEqual([[3, orgOwner]]);
        expect(catalogue.models.map((r) => [r.id, r.owner, r.brand.id])).toEqual([
            [4, orgOwner, 3],
        ]);
    });
});
