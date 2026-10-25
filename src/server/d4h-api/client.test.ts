/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { ForbiddenError } from "@/lib/errors";
import type { D4HAccessToken_ServerOnly } from "@/lib/schemas/d4h-access-token";
import { ProviderCredentialId } from "@/lib/schemas/provider-credential";
import { getD4HAccessToken } from "@/server/d4h-access-token";

import { fetchD4HMember, getD4HFetchClient } from "./client";

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

describe("fetchD4HMember", () => {
    const token: D4HAccessToken_ServerOnly = {
        id: ProviderCredentialId.create(),
        organizationId: null,
        userId: null,
        label: "Test token",
        serverCode: "us",
        token: "the-api-key",
        metadata: { d4HTeams: [], d4HOrganisations: [] },
    };

    const member = {
        id: 42,
        resourceType: "Member",
        email: { value: "jane@example.com", verified: true },
        name: "Jane Doe",
        owner: { id: 7, resourceType: "Team" },
        position: null,
        ref: "J1",
        role: { id: null, resourceType: "Role" },
        status: "OPERATIONAL",
    };

    function stubFetch(response: Response) {
        const fetchMock = vi.fn(async (_request: Request) => response);
        vi.stubGlobal("fetch", fetchMock);
        return fetchMock;
    }

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("requests the member through the team context and parses it", async () => {
        const fetchMock = stubFetch(Response.json(member));

        const result = await fetchD4HMember(token, 7, 42);

        expect(new URL(fetchMock.mock.calls[0][0].url).pathname).toBe("/v3/team/7/members/42");
        expect(result).toMatchObject({
            id: 42,
            name: "Jane Doe",
            email: { value: "jane@example.com", verified: true },
        });
    });

    it("maps a null email to null", async () => {
        stubFetch(Response.json({ ...member, email: null }));

        expect(await fetchD4HMember(token, 7, 42)).toMatchObject({ id: 42, email: null });
    });

    it("maps a missing email or a null email value to null", async () => {
        const { email: _email, ...withoutEmail } = member;
        stubFetch(Response.json(withoutEmail));
        expect(await fetchD4HMember(token, 7, 42)).toMatchObject({ email: null });

        stubFetch(Response.json({ ...member, email: { value: null, verified: false } }));
        expect(await fetchD4HMember(token, 7, 42)).toMatchObject({ email: null });
    });

    it("returns null on 404", async () => {
        stubFetch(new Response(null, { status: 404, statusText: "Not Found" }));

        expect(await fetchD4HMember(token, 7, 42)).toBeNull();
    });

    it("throws a ForbiddenError on 403", async () => {
        stubFetch(new Response(null, { status: 403, statusText: "Forbidden" }));

        await expect(fetchD4HMember(token, 7, 42)).rejects.toBeInstanceOf(ForbiddenError);
    });

    it("throws on any other failure", async () => {
        stubFetch(new Response(null, { status: 500, statusText: "Internal Server Error" }));

        const error = await fetchD4HMember(token, 7, 42).catch((e: unknown) => e);
        expect(error).toBeInstanceOf(Error);
        expect(error).not.toBeInstanceOf(ForbiddenError);
        expect((error as Error).message).toContain("500");
    });
});
