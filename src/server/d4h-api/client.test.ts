/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import type { D4HAccessToken_ServerOnly } from "@/lib/schemas/d4h-access-token";
import { ProviderCredentialId } from "@/lib/schemas/provider-credential";
import { getD4HAccessToken } from "@/server/d4h-access-token";

import { getD4HFetchClient } from "./client";

vi.mock("server-only", () => ({}));

vi.mock("next/cache", () => ({ cacheLife: vi.fn(), cacheTag: vi.fn(), revalidateTag: vi.fn() }));

// The real accessor, wrapped in a spy so the test can see the client went through it. Its module
// pulls in Prisma and the settings cache, neither of which the accessor touches.
vi.mock("@/server/d4h-access-token", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/server/d4h-access-token")>();
    return { ...actual, getD4HAccessToken: vi.fn(actual.getD4HAccessToken) };
});
vi.mock("@/server/prisma", () => ({ default: {} }));
vi.mock("@/server/encrypt", () => ({ decryptDBValue: (value: string) => value }));
vi.mock("@/server/cache/organization-settings", () => ({ getOrganizationSettings: vi.fn() }));

describe("getD4HFetchClient", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("sends the credential's key as a bearer token, read through getD4HAccessToken", async () => {
        const fetchMock = vi.fn(async (_request: Request) => Response.json({}));
        vi.stubGlobal("fetch", fetchMock);

        const token: D4HAccessToken_ServerOnly = {
            id: ProviderCredentialId.create(),
            organizationId: null,
            userId: null,
            label: "Test token",
            serverCode: "us",
            token: "the-api-key",
            metadata: { d4HTeams: [], d4HOrganisations: [] },
        };

        await getD4HFetchClient(token).GET("/v3/whoami");

        expect(getD4HAccessToken).toHaveBeenCalledWith(token);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        const request = fetchMock.mock.calls[0][0];
        expect(request.headers.get("Authorization")).toBe("Bearer the-api-key");
    });
});
