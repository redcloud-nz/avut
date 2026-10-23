/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { ForbiddenError } from "@/lib/errors";
import type { D4HAccessToken_ServerOnly } from "@/lib/schemas/d4h-access-token";
import { ProviderCredentialId } from "@/lib/schemas/provider-credential";

import { fetchD4HEquipmentItem, patchD4HEquipmentItem } from "./equipment";

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
    location: {
        resourceType: "Member",
        id: 99,
        name: "Jane Doe",
        address: "1 Secret Street",
        mobilephone: "+64 21 000 0000",
    },
};

describe("fetchD4HEquipmentItem", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("parses the item and strips its location", async () => {
        const fetchMock = vi.fn(async (_request: Request) => Response.json(itemFixture));
        vi.stubGlobal("fetch", fetchMock);

        const item = await fetchD4HEquipmentItem(token, 7, 1234);

        expect(item).not.toBeNull();
        expect(item).not.toHaveProperty("location");
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
