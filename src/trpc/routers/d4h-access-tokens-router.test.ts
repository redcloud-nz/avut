/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { beforeAll, describe, expect, it, vi } from "vitest";

import { D4HServerCode } from "@/lib/d4h-servers";
import { nanoId16 } from "@/lib/id";
import { D4HAccessTokenId } from "@/lib/schemas/d4h-access-token";
import { OrganizationId } from "@/lib/schemas/organization";
import { revalidateD4HAccessToken } from "@/server/d4h-access-token";
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

// d4h-access-tokens-router reaches @/server/auth at import time via ../init. It also imports
// @/server/d4h-api/client and @/server/d4h-access-token, both of which pull in next/cache and
// are not exercised by these tests (they cover the audit-log redaction, not live D4H calls or
// encryption) — stub them out so the module loads under jsdom and never makes a network call.
vi.mock("server-only", () => ({}));

vi.mock("@/server/d4h-api/client", () => ({
    getD4HFetchClient: vi.fn(() => ({
        GET: vi.fn(async () => ({ data: undefined, response: { statusText: "OK" } })),
    })),
    getD4HTokenMetadata: vi.fn(async () => ({ d4HTeams: [], d4HOrganisations: [] })),
}));

vi.mock("@/server/d4h-access-token", () => ({
    revalidateD4HAccessToken: vi.fn(),
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
        const tokenId = D4HAccessTokenId.create();

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
});

describe("d4hAccessTokensRouter.createPersonalAccessToken", () => {
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
                permissions: { organization: ["view"] },
                prisma: db,
            }),
        );
    }

    it("never records the raw token in the audit log or returns it", async () => {
        const tokenId = D4HAccessTokenId.create();

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
});

describe("d4hAccessTokensRouter.deleteOrganizationAccessToken", () => {
    const T = {
        org: OrganizationId.create(),
        user: nanoId16(),
        syncToken: D4HAccessTokenId.create(),
        otherToken: D4HAccessTokenId.create(),
        member: nanoId16(),
        personalToken: D4HAccessTokenId.create(),
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

describe("d4hAccessTokensRouter.refreshToken", () => {
    const T = {
        org: OrganizationId.create(),
        user: nanoId16(),
        orgToken: D4HAccessTokenId.create(),
        member: nanoId16(),
        personalToken: D4HAccessTokenId.create(),
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

    it("revalidates the cached credential", async () => {
        await makeCaller().refreshToken({ organizationId: T.org, tokenId: T.orgToken });

        expect(revalidateD4HAccessToken).toHaveBeenCalledWith(T.orgToken);
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
        orgToken: D4HAccessTokenId.create(),
        personalToken: D4HAccessTokenId.create(),
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
