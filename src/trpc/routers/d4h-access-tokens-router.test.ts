/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { beforeAll, describe, expect, it, vi } from "vitest";

import { D4HServerCode } from "@/lib/d4h-servers";
import { nanoId16 } from "@/lib/id";
import { D4HAccessTokenMetadata } from "@/lib/schemas/d4h-provider-metadata";
import { OrganizationId } from "@/lib/schemas/organization";
import { ProviderCredentialId } from "@/lib/schemas/provider-credential";
import {
    revalidateD4HAccessToken,
    revalidateD4HApiCache,
    revalidatePersonalD4HAccessTokenForUser,
} from "@/server/d4h-access-token";
import { validateD4HCredential } from "@/server/d4h-api/client";
import { createMockPrisma } from "@/test/create-prisma-mock";
import { createAuthenticatedMockContext } from "@/test/trpc-helpers";

import { d4hAccessTokensRouter } from "./d4h-access-tokens-router";

/** A `ProviderCredential` row for seeding. `expiresAt` is a `Date` because prisma-mock stores
 * DateTime values verbatim. */
function credentialData({
    id,
    organizationId,
    userId,
    groupId = null,
}: {
    id: string;
    organizationId: string;
    userId: string | null;
    groupId?: string | null;
}) {
    return {
        id,
        provider: "D4H" as const,
        organizationId,
        userId,
        groupId,
        label: "Seeded token",
        token: "encrypted:seeded-secret",
        status: "OK",
        expiresAt: new Date("2036-01-01T00:00:00Z"),
        metadata: { provider: "D4H", serverCode: "us", d4HTeams: [], d4HOrganisations: [] },
    };
}

/** Stored metadata that isn't empty, so a test can tell "kept" from "overwritten with empty lists". */
const storedMetadata = {
    provider: "D4H",
    serverCode: "us",
    d4HTeams: [
        {
            id: 7,
            title: "Stored Team",
            resourceType: "Team",
            permissions: { Equipment: { CREATE: true } },
        },
    ],
    d4HOrganisations: [],
};

/** What `validateD4HCredential` returns for a token D4H refuses. */
const rejected = { ok: false, status: 401, statusText: "Unauthorized" } as const;

// d4h-access-tokens-router reaches @/server/auth at import time via ../init. It also imports
// @/server/d4h-api/client and @/server/d4h-access-token, both of which pull in next/cache and
// are not exercised by these tests (they cover the audit-log redaction, not live D4H calls or
// encryption) — stub them out so the module loads under jsdom and never makes a network call.
vi.mock("server-only", () => ({}));

vi.mock("@/server/d4h-api/client", () => ({
    validateD4HCredential: vi.fn(async () => ({
        ok: true,
        status: 200,
        statusText: "OK",
        metadata: { d4HTeams: [], d4HOrganisations: [] },
    })),
}));

vi.mock("@/server/d4h-access-token", () => ({
    revalidateD4HAccessToken: vi.fn(),
    revalidateD4HApiCache: vi.fn(),
    revalidatePersonalD4HAccessTokenForUser: vi.fn(),
    toServerOnlyD4HAccessToken: vi.fn((record: { id: string }) => ({
        id: record.id,
        serverCode: "us",
        token: "seeded-secret",
    })),
}));

vi.mock("@/server/cache/organization-settings", () => ({
    revalidateOrganizationSettings: vi.fn(),
}));

vi.mock("@/server/encrypt", () => ({
    encryptDBValue: (value: string) => `encrypted:${value}`,
    decryptDBValue: (value: string) => value.replace(/^encrypted:/, ""),
}));

describe("d4hAccessTokensRouter.createOrganizationAccessToken", () => {
    const T = {
        org: OrganizationId.create(),
        user: nanoId16(),
    };

    const db = createMockPrisma();

    beforeAll(async () => {
        await db.organization.create({
            data: { id: T.org, name: "Acme", slug: "acme", createdAt: new Date() },
        });
    });

    function makeCaller() {
        return d4hAccessTokensRouter.createCaller(
            createAuthenticatedMockContext({
                user: { id: T.user },
                permissions: { organization: ["update", "view"] },
                prisma: db,
            }),
        );
    }

    it("never records the raw token in the audit log or returns it", async () => {
        const tokenId = ProviderCredentialId.create();

        const result = await makeCaller().createOrganizationAccessToken({
            organizationId: T.org,
            tokenId,
            create: {
                serverCode: "us" as D4HServerCode,
                label: "Test token",
                token: "super-secret-d4h-key",
            },
        });

        expect(result.created).not.toHaveProperty("token");

        const entries = await db.logEntry.findMany({
            where: { organizationId: T.org },
        });

        expect(entries).toHaveLength(1);
        const changes = entries[0].changes as unknown[];

        // The secret value must never appear anywhere in the recorded changes.
        expect(JSON.stringify(changes)).not.toContain("super-secret-d4h-key");

        // ...and the field is explicitly masked, not merely omitted.
        expect(changes).toContainEqual({ type: "obj_mask", path: ["token"] });

        // The rest of the create payload is still recorded normally.
        expect(changes).toContainEqual({
            type: "obj_add",
            path: ["label"],
            curr: "Test token",
        });

        // The token itself is still persisted (encrypted) on the record.
        const stored = await db.providerCredential.findUniqueOrThrow({ where: { id: tokenId } });
        expect(stored.token).not.toBe("super-secret-d4h-key");
    });

    it("rejects a token D4H refuses, saving and logging nothing", async () => {
        vi.mocked(validateD4HCredential).mockResolvedValueOnce(rejected);
        const tokenId = ProviderCredentialId.create();
        const logCountBefore = await db.logEntry.count({ where: { organizationId: T.org } });

        await expect(
            makeCaller().createOrganizationAccessToken({
                organizationId: T.org,
                tokenId,
                create: { serverCode: "us" as D4HServerCode, label: "Bad", token: "bad-key" },
            }),
        ).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringContaining("401") });

        expect(await db.providerCredential.findUnique({ where: { id: tokenId } })).toBeNull();
        expect(await db.logEntry.count({ where: { organizationId: T.org } })).toBe(logCountBefore);
    });

    it("reports a D4H error that isn't a rejection as BAD_GATEWAY, saving nothing", async () => {
        vi.mocked(validateD4HCredential).mockResolvedValueOnce({
            ok: false,
            status: 503,
            statusText: "Service Unavailable",
        });
        const tokenId = ProviderCredentialId.create();

        const error = await makeCaller()
            .createOrganizationAccessToken({
                organizationId: T.org,
                tokenId,
                create: { serverCode: "us" as D4HServerCode, label: "Down", token: "good-key" },
            })
            .catch((e: unknown) => e);

        expect(error).toMatchObject({
            code: "BAD_GATEWAY",
            message: expect.stringContaining("503"),
        });
        expect((error as Error).message).not.toMatch(/rejected/);
        expect(await db.providerCredential.findUnique({ where: { id: tokenId } })).toBeNull();
    });
});

describe("d4hAccessTokensRouter.createPersonalAccessToken", () => {
    const T = {
        org: OrganizationId.create(),
        user: nanoId16(),
        userWithToken: nanoId16(),
        existingToken: ProviderCredentialId.create(),
    };

    const db = createMockPrisma();

    beforeAll(async () => {
        await db.organization.create({
            data: { id: T.org, name: "Acme", slug: "acme", createdAt: new Date() },
        });
        await db.providerCredential.create({
            data: credentialData({
                id: T.existingToken,
                organizationId: T.org,
                userId: T.userWithToken,
            }),
        });
    });

    function makeCaller(userId: string = T.user) {
        return d4hAccessTokensRouter.createCaller(
            createAuthenticatedMockContext({
                user: { id: userId },
                permissions: { organization: ["view"] },
                prisma: db,
            }),
        );
    }

    it("never records the raw token in the audit log or returns it", async () => {
        const tokenId = ProviderCredentialId.create();

        const result = await makeCaller().createPersonalAccessToken({
            organizationId: T.org,
            tokenId,
            create: {
                serverCode: "us" as D4HServerCode,
                token: "another-super-secret-key",
            },
        });

        expect(result.created).not.toHaveProperty("token");

        const entries = await db.logEntry.findMany({
            where: { organizationId: T.org },
        });

        expect(entries).toHaveLength(1);
        const changes = entries[0].changes as unknown[];

        expect(JSON.stringify(changes)).not.toContain("another-super-secret-key");
        expect(changes).toContainEqual({ type: "obj_mask", path: ["token"] });
    });

    it("refuses a second personal token in the same organization", async () => {
        const tokenId = ProviderCredentialId.create();

        await expect(
            makeCaller(T.userWithToken).createPersonalAccessToken({
                organizationId: T.org,
                tokenId,
                create: { serverCode: "us" as D4HServerCode, token: "second-key" },
            }),
        ).rejects.toMatchObject({ code: "CONFLICT" });

        expect(validateD4HCredential).not.toHaveBeenCalled();
        expect(await db.providerCredential.findUnique({ where: { id: tokenId } })).toBeNull();
    });

    it("rejects a token D4H refuses, saving and logging nothing", async () => {
        vi.mocked(validateD4HCredential).mockResolvedValueOnce(rejected);
        const tokenId = ProviderCredentialId.create();
        const logCountBefore = await db.logEntry.count({ where: { organizationId: T.org } });

        await expect(
            makeCaller(nanoId16()).createPersonalAccessToken({
                organizationId: T.org,
                tokenId,
                create: { serverCode: "us" as D4HServerCode, token: "bad-key" },
            }),
        ).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringContaining("401") });

        expect(await db.providerCredential.findUnique({ where: { id: tokenId } })).toBeNull();
        expect(await db.logEntry.count({ where: { organizationId: T.org } })).toBe(logCountBefore);
    });
});

describe("d4hAccessTokensRouter.deleteOrganizationAccessToken", () => {
    const T = {
        org: OrganizationId.create(),
        user: nanoId16(),
        syncToken: ProviderCredentialId.create(),
        otherToken: ProviderCredentialId.create(),
        member: nanoId16(),
        personalToken: ProviderCredentialId.create(),
    };

    const db = createMockPrisma();

    beforeAll(async () => {
        await db.organization.create({
            data: { id: T.org, name: "Acme", slug: "acme", createdAt: new Date() },
        });
        for (const id of [T.syncToken, T.otherToken]) {
            await db.providerCredential.create({
                data: credentialData({ id, organizationId: T.org, userId: null }),
            });
        }
        await db.providerCredential.create({
            data: credentialData({ id: T.personalToken, organizationId: T.org, userId: T.member }),
        });
        await db.organizationConfig.create({
            data: { organizationId: T.org, key: "integrations.d4h.syncToken", value: T.syncToken },
        });
    });

    function makeCaller() {
        return d4hAccessTokensRouter.createCaller(
            createAuthenticatedMockContext({
                user: { id: T.user },
                permissions: { organization: ["view", "update"] },
                prisma: db,
            }),
        );
    }

    it("deletes a token that isn't the configured sync token", async () => {
        await makeCaller().deleteOrganizationAccessToken({
            organizationId: T.org,
            tokenId: T.otherToken,
        });

        expect(await db.providerCredential.findUnique({ where: { id: T.otherToken } })).toBeNull();
        expect(revalidateD4HAccessToken).toHaveBeenCalledWith(T.otherToken);
        expect(revalidateD4HApiCache).toHaveBeenCalledWith(T.otherToken);

        // The sync token's config entry is untouched.
        const config = await db.organizationConfig.findUnique({
            where: {
                organizationId_key: { organizationId: T.org, key: "integrations.d4h.syncToken" },
            },
        });
        expect(config?.value).toBe(T.syncToken);
    });

    it("deletes the sync token and its config entry", async () => {
        await makeCaller().deleteOrganizationAccessToken({
            organizationId: T.org,
            tokenId: T.syncToken,
        });

        expect(await db.providerCredential.findUnique({ where: { id: T.syncToken } })).toBeNull();
        expect(
            await db.organizationConfig.findUnique({
                where: {
                    organizationId_key: {
                        organizationId: T.org,
                        key: "integrations.d4h.syncToken",
                    },
                },
            }),
        ).toBeNull();
        expect(revalidateD4HAccessToken).toHaveBeenCalledWith(T.syncToken);
        expect(revalidateD4HApiCache).toHaveBeenCalledWith(T.syncToken);
    });

    it("refuses to delete a member's personal token", async () => {
        await expect(
            makeCaller().deleteOrganizationAccessToken({
                organizationId: T.org,
                tokenId: T.personalToken,
            }),
        ).rejects.toMatchObject({ code: "NOT_FOUND" });

        expect(
            await db.providerCredential.findUnique({ where: { id: T.personalToken } }),
        ).not.toBeNull();
    });
});

describe("d4hAccessTokensRouter.deletePersonalAccessToken", () => {
    const T = {
        org: OrganizationId.create(),
        user: nanoId16(),
        personalToken: ProviderCredentialId.create(),
    };

    const db = createMockPrisma();

    beforeAll(async () => {
        await db.organization.create({
            data: { id: T.org, name: "Acme", slug: "acme", createdAt: new Date() },
        });
        await db.providerCredential.create({
            data: credentialData({ id: T.personalToken, organizationId: T.org, userId: T.user }),
        });
    });

    function makeCaller() {
        return d4hAccessTokensRouter.createCaller(
            createAuthenticatedMockContext({
                user: { id: T.user },
                permissions: { organization: ["view"] },
                prisma: db,
            }),
        );
    }

    it("deletes the caller's token and revalidates every cache keyed on it", async () => {
        await makeCaller().deletePersonalAccessToken({ organizationId: T.org });

        expect(
            await db.providerCredential.findUnique({ where: { id: T.personalToken } }),
        ).toBeNull();
        expect(revalidatePersonalD4HAccessTokenForUser).toHaveBeenCalledWith(T.org, T.user);
        expect(revalidateD4HAccessToken).toHaveBeenCalledWith(T.personalToken);
        expect(revalidateD4HApiCache).toHaveBeenCalledWith(T.personalToken);
    });
});

describe("d4hAccessTokensRouter.refreshPersonalAccessToken", () => {
    const T = {
        org: OrganizationId.create(),
        user: nanoId16(),
        userWithoutToken: nanoId16(),
        otherUser: nanoId16(),
        otherUsersToken: ProviderCredentialId.create(),
        personalToken: ProviderCredentialId.create(),
        userWithRejectedToken: nanoId16(),
        rejectedToken: ProviderCredentialId.create(),
    };

    const refreshedMetadata: D4HAccessTokenMetadata = {
        d4HTeams: [
            {
                id: 42,
                title: "Refreshed Team",
                resourceType: "Team",
                permissions: { Equipment: { CREATE: true } },
            },
        ],
        d4HOrganisations: [],
    };

    const db = createMockPrisma();

    beforeAll(async () => {
        await db.organization.create({
            data: { id: T.org, name: "Acme", slug: "acme", createdAt: new Date() },
        });
        await db.providerCredential.create({
            data: {
                ...credentialData({ id: T.personalToken, organizationId: T.org, userId: T.user }),
                status: "Unauthorized",
            },
        });
        await db.providerCredential.create({
            data: credentialData({
                id: T.otherUsersToken,
                organizationId: T.org,
                userId: T.otherUser,
            }),
        });
        await db.providerCredential.create({
            data: {
                ...credentialData({
                    id: T.rejectedToken,
                    organizationId: T.org,
                    userId: T.userWithRejectedToken,
                }),
                metadata: storedMetadata,
            },
        });
    });

    function makeCaller(userId: string = T.user) {
        return d4hAccessTokensRouter.createCaller(
            createAuthenticatedMockContext({
                user: { id: userId },
                permissions: { organization: ["view"] },
                prisma: db,
            }),
        );
    }

    it("throws NOT_FOUND when the caller has no personal token", async () => {
        await expect(
            makeCaller(T.userWithoutToken).refreshPersonalAccessToken({
                organizationId: T.org,
                tokenId: ProviderCredentialId.create(),
            }),
        ).rejects.toMatchObject({ code: "NOT_FOUND" });

        expect(validateD4HCredential).not.toHaveBeenCalled();
    });

    it("throws NOT_FOUND for another user's token without calling D4H", async () => {
        await expect(
            makeCaller().refreshPersonalAccessToken({
                organizationId: T.org,
                tokenId: T.otherUsersToken,
            }),
        ).rejects.toMatchObject({ code: "NOT_FOUND" });

        expect(validateD4HCredential).not.toHaveBeenCalled();
    });

    it("refreshes the requested token and revalidates every cache keyed on it", async () => {
        vi.mocked(validateD4HCredential).mockResolvedValueOnce({
            ok: true,
            status: 200,
            statusText: "OK",
            metadata: refreshedMetadata,
        });

        await makeCaller().refreshPersonalAccessToken({
            organizationId: T.org,
            tokenId: T.personalToken,
        });

        const stored = await db.providerCredential.findUniqueOrThrow({
            where: { id: T.personalToken },
        });
        expect(stored.status).toBe("OK");
        expect(stored.metadata).toEqual({
            provider: "D4H",
            serverCode: "us",
            ...refreshedMetadata,
        });

        const entries = await db.logEntry.findMany({ where: { organizationId: T.org } });
        expect(entries).toHaveLength(1);
        expect(entries[0].objectId).toBe(T.personalToken);

        expect(revalidatePersonalD4HAccessTokenForUser).toHaveBeenCalledWith(T.org, T.user);
        expect(revalidateD4HAccessToken).toHaveBeenCalledWith(T.personalToken);
        expect(revalidateD4HApiCache).toHaveBeenCalledWith(T.personalToken);
    });

    it("records a rejected token's status but keeps its metadata", async () => {
        vi.mocked(validateD4HCredential).mockResolvedValueOnce(rejected);

        await makeCaller(T.userWithRejectedToken).refreshPersonalAccessToken({
            organizationId: T.org,
            tokenId: T.rejectedToken,
        });

        const stored = await db.providerCredential.findUniqueOrThrow({
            where: { id: T.rejectedToken },
        });
        expect(stored.status).toBe("Unauthorized");
        expect(stored.metadata).toEqual(storedMetadata);
    });
});

describe("d4hAccessTokensRouter.refreshToken", () => {
    const T = {
        org: OrganizationId.create(),
        user: nanoId16(),
        orgToken: ProviderCredentialId.create(),
        rejectedToken: ProviderCredentialId.create(),
        noStatusTextToken: ProviderCredentialId.create(),
        member: nanoId16(),
        personalToken: ProviderCredentialId.create(),
    };

    const db = createMockPrisma();

    beforeAll(async () => {
        await db.organization.create({
            data: { id: T.org, name: "Acme", slug: "acme", createdAt: new Date() },
        });
        await db.providerCredential.create({
            data: credentialData({ id: T.orgToken, organizationId: T.org, userId: null }),
        });
        await db.providerCredential.create({
            data: {
                ...credentialData({ id: T.rejectedToken, organizationId: T.org, userId: null }),
                metadata: storedMetadata,
            },
        });
        await db.providerCredential.create({
            data: credentialData({ id: T.noStatusTextToken, organizationId: T.org, userId: null }),
        });
        await db.providerCredential.create({
            data: credentialData({ id: T.personalToken, organizationId: T.org, userId: T.member }),
        });
    });

    function makeCaller() {
        return d4hAccessTokensRouter.createCaller(
            createAuthenticatedMockContext({
                user: { id: T.user },
                permissions: { organization: ["view", "update"] },
                prisma: db,
            }),
        );
    }

    it("revalidates the cached credential and its D4H API cache", async () => {
        await makeCaller().refreshToken({ organizationId: T.org, tokenId: T.orgToken });

        expect(revalidateD4HAccessToken).toHaveBeenCalledWith(T.orgToken);
        expect(revalidateD4HApiCache).toHaveBeenCalledWith(T.orgToken);
    });

    it("records a rejected token's status but keeps its metadata", async () => {
        vi.mocked(validateD4HCredential).mockResolvedValueOnce(rejected);

        await makeCaller().refreshToken({ organizationId: T.org, tokenId: T.rejectedToken });

        const stored = await db.providerCredential.findUniqueOrThrow({
            where: { id: T.rejectedToken },
        });
        expect(stored.status).toBe("Unauthorized");
        expect(stored.metadata).toEqual(storedMetadata);

        const entries = await db.logEntry.findMany({ where: { objectId: T.rejectedToken } });
        expect(entries).toHaveLength(1);
        expect(entries[0].changes).toEqual([
            { type: "obj_mod", path: ["status"], prev: "OK", curr: "Unauthorized" },
        ]);
        expect(entries[0].description).not.toMatch(/Refreshed/);
    });

    it("stores the HTTP status when D4H sends no status text", async () => {
        vi.mocked(validateD4HCredential).mockResolvedValueOnce({
            ok: false,
            status: 401,
            statusText: "",
        });

        await makeCaller().refreshToken({ organizationId: T.org, tokenId: T.noStatusTextToken });

        const stored = await db.providerCredential.findUniqueOrThrow({
            where: { id: T.noStatusTextToken },
        });
        expect(stored.status).toBe("HTTP 401");

        const entries = await db.logEntry.findMany({ where: { objectId: T.noStatusTextToken } });
        expect(entries[0].changes).toEqual([
            { type: "obj_mod", path: ["status"], prev: "OK", curr: "HTTP 401" },
        ]);
    });

    it("refuses to refresh a member's personal token", async () => {
        await expect(
            makeCaller().refreshToken({ organizationId: T.org, tokenId: T.personalToken }),
        ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
});

describe("d4hAccessTokensRouter queries never return the token", () => {
    const T = {
        org: OrganizationId.create(),
        user: nanoId16(),
        orgToken: ProviderCredentialId.create(),
        personalToken: ProviderCredentialId.create(),
    };

    const db = createMockPrisma();

    beforeAll(async () => {
        await db.organization.create({
            data: { id: T.org, name: "Acme Rescue", slug: "acme", createdAt: new Date() },
        });
        await db.providerCredential.create({
            data: credentialData({ id: T.orgToken, organizationId: T.org, userId: null }),
        });
        await db.providerCredential.create({
            data: credentialData({ id: T.personalToken, organizationId: T.org, userId: T.user }),
        });
    });

    function makeCaller() {
        return d4hAccessTokensRouter.createCaller(
            createAuthenticatedMockContext({
                user: { id: T.user },
                permissions: { organization: ["view", "update"] },
                prisma: db,
            }),
        );
    }

    it("getOrganizationAccessToken", async () => {
        const result = await makeCaller().getOrganizationAccessToken({
            organizationId: T.org,
            tokenId: T.orgToken,
        });

        expect(result.id).toBe(T.orgToken);
        expect(result).not.toHaveProperty("token");
    });

    it("getPersonalAccessToken", async () => {
        const result = await makeCaller().getPersonalAccessToken({ organizationId: T.org });

        expect(result?.id).toBe(T.personalToken);
        expect(result).not.toHaveProperty("token");
    });

    it("listOrganizationAccessTokens", async () => {
        const result = await makeCaller().listOrganizationAccessTokens({ organizationId: T.org });

        expect(result.map((token) => token.id)).toEqual([T.orgToken]);
        for (const token of result) expect(token).not.toHaveProperty("token");
    });

    it("listPersonalAccessTokens", async () => {
        const result = await makeCaller().listPersonalAccessTokens();

        expect(result.map((token) => token.id)).toEqual([T.personalToken]);
        for (const token of result) expect(token).not.toHaveProperty("token");
    });
});
