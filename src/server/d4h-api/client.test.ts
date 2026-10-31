/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { ForbiddenError } from "@/lib/errors";
import type { D4HAccessToken_ServerOnly } from "@/lib/schemas/d4h-access-token";
import { ProviderCredentialId } from "@/lib/schemas/provider-credential";
import { getD4HAccessToken } from "@/server/d4h-access-token";

import {
    fetchD4HCurrentTeamMembers,
    fetchD4HExercisesStartingBetween,
    fetchD4HMember,
    fetchD4HMembersByIds,
    fetchD4HRequestedAttendance,
    getD4HFetchClient,
} from "./client";

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

describe("D4H list fetches for attendance reminders", () => {
    const token: D4HAccessToken_ServerOnly = {
        id: ProviderCredentialId.create(),
        organizationId: null,
        userId: null,
        label: "Test token",
        serverCode: "ap",
        token: "the-api-key",
        metadata: { d4HTeams: [], d4HOrganisations: [] },
    };

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

    function requestedUrl(fetchMock: ReturnType<typeof stubList>, call = 0) {
        return new URL(fetchMock.mock.calls[call][0].url);
    }

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    describe("fetchD4HExercisesStartingBetween", () => {
        it("filters on starts_after and before, asking for the whole list", async () => {
            const fetchMock = stubList([
                {
                    id: 11,
                    reference: "TR-1",
                    referenceDescription: "Rope training",
                    startsAt: "2026-11-03T06:00:00.000Z",
                    endsAt: "2026-11-03T08:00:00.000Z",
                },
            ]);

            const result = await fetchD4HExercisesStartingBetween(token, 7, {
                startsAfter: new Date("2026-11-02T00:00:00.000Z"),
                startsBefore: new Date("2026-11-03T00:00:00.000Z"),
            });

            const url = requestedUrl(fetchMock);
            expect(url.pathname).toBe("/v3/team/7/exercises");
            expect(url.searchParams.get("starts_after")).toBe("2026-11-02T00:00:00.000Z");
            expect(url.searchParams.get("before")).toBe("2026-11-03T00:00:00.000Z");
            expect(url.searchParams.has("after")).toBe(false);
            expect(url.searchParams.get("size")).toBe("10000");
            expect(result).toMatchObject([{ id: 11, referenceDescription: "Rope training" }]);
        });

        it("throws on failure", async () => {
            vi.stubGlobal(
                "fetch",
                vi.fn(async () => new Response(null, { status: 500, statusText: "Server Error" })),
            );

            await expect(
                fetchD4HExercisesStartingBetween(token, 7, {
                    startsAfter: new Date(),
                    startsBefore: new Date(),
                }),
            ).rejects.toThrow("500");
        });
    });

    describe("fetchD4HRequestedAttendance", () => {
        const attendance = {
            id: 900,
            resourceType: "ActivityAttendance",
            activity: { id: 11, resourceType: "Exercise" },
            member: { id: 42, resourceType: "Member" },
            status: "REQUESTED",
            startsAt: "2026-11-03T06:00:00.000Z",
            endsAt: "2026-11-03T08:00:00.000Z",
        };

        it("filters on activity_id and status=REQUESTED, asking for the whole list", async () => {
            const fetchMock = stubList([attendance]);

            const result = await fetchD4HRequestedAttendance(token, 7, [11, 12]);

            expect(fetchMock).toHaveBeenCalledTimes(1);
            const url = requestedUrl(fetchMock);
            expect(url.pathname).toBe("/v3/team/7/attendance");
            expect(url.searchParams.getAll("activity_id")).toEqual(["11", "12"]);
            expect(url.searchParams.get("status")).toBe("REQUESTED");
            expect(url.searchParams.get("size")).toBe("10000");
            expect(result).toMatchObject([{ id: 900, member: { id: 42 } }]);
        });

        it("splits a long id list across requests", async () => {
            const fetchMock = stubList([attendance]);
            const ids = Array.from({ length: 150 }, (_, i) => i + 1);

            const result = await fetchD4HRequestedAttendance(token, 7, ids);

            expect(fetchMock).toHaveBeenCalledTimes(2);
            expect(requestedUrl(fetchMock, 0).searchParams.getAll("activity_id")).toHaveLength(100);
            expect(requestedUrl(fetchMock, 1).searchParams.getAll("activity_id")).toHaveLength(50);
            expect(result).toHaveLength(2);
        });

        it("makes no request for no exercises", async () => {
            const fetchMock = stubList([]);

            expect(await fetchD4HRequestedAttendance(token, 7, [])).toEqual([]);
            expect(fetchMock).not.toHaveBeenCalled();
        });
    });

    describe("fetchD4HMembersByIds", () => {
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

        it("filters on id, asking for the whole list", async () => {
            const fetchMock = stubList([member]);

            await fetchD4HMembersByIds(token, 7, [42, 43]);

            const url = requestedUrl(fetchMock);
            expect(url.pathname).toBe("/v3/team/7/members");
            expect(url.searchParams.getAll("id")).toEqual(["42", "43"]);
            expect(url.searchParams.get("size")).toBe("10000");
        });

        it("parses a member with a null email to email: null without failing the batch", async () => {
            stubList([member, { ...member, id: 43, name: "No Email", email: null }]);

            expect(await fetchD4HMembersByIds(token, 7, [42, 43])).toMatchObject([
                { id: 42, email: { value: "jane@example.com", verified: true } },
                { id: 43, email: null },
            ]);
        });

        it("makes no request for no members", async () => {
            const fetchMock = stubList([]);

            expect(await fetchD4HMembersByIds(token, 7, [])).toEqual([]);
            expect(fetchMock).not.toHaveBeenCalled();
        });
    });

    describe("fetchD4HCurrentTeamMembers", () => {
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

        it("filters to current members, asking for the whole list", async () => {
            const fetchMock = stubList([member]);

            await fetchD4HCurrentTeamMembers(token, 7);

            const url = requestedUrl(fetchMock);
            expect(url.pathname).toBe("/v3/team/7/members");
            expect(url.searchParams.getAll("status")).toEqual(["OPERATIONAL", "NON_OPERATIONAL"]);
            expect(url.searchParams.get("size")).toBe("10000");
        });

        it("parses a member with no email without failing the list", async () => {
            stubList([member, { ...member, id: 43, name: "No Email", email: null }]);

            expect(await fetchD4HCurrentTeamMembers(token, 7)).toMatchObject([
                { id: 42 },
                { id: 43, email: null },
            ]);
        });
    });
});
